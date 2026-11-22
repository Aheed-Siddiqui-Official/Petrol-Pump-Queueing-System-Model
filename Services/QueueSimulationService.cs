using System.Globalization;
using PetrolQueueCalculator.Models;

namespace PetrolQueueCalculator.Services;

public class QueueSimulationService : IQueueSimulationService
{
    private static readonly Dictionary<string, double> Units = new(StringComparer.OrdinalIgnoreCase)
    {
        ["seconds"] = 1.0,
        ["minutes"] = 60.0,
        ["hours"] = 3600.0
    };

    private static readonly Dictionary<string, string> UnitSingular = new(StringComparer.OrdinalIgnoreCase)
    {
        ["seconds"] = "second",
        ["minutes"] = "minute",
        ["hours"] = "hour"
    };

    private static readonly PetrolDataPreset CachedPreset = new();

    public PetrolDataPreset GetPresetData() => CachedPreset;

    public QueueCalculationResponse Calculate(QueueCalculationRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        var model = request.Model?.Trim().ToUpperInvariant() ?? string.Empty;
        if (model is not ("MM1" or "MG1" or "GG1"))
        {
            throw new ArgumentException("Unknown queue model. Supported models are MM1, MG1, and GG1.");
        }

        var displayUnit = request.DisplayUnit?.Trim().ToLowerInvariant() ?? string.Empty;
        if (!Units.TryGetValue(displayUnit, out var displayUnitSeconds))
        {
            throw new ArgumentException("Unknown display unit. Supported units: seconds, minutes, hours.");
        }

        var arr = ReadSide(request.Arrival, "Arrival", displayUnit, model.StartsWith("GG"));
        var svc = ReadSide(request.Service, "Service", displayUnit, model != "MM1");

        var one = UnitSingular[displayUnit];
        var lambda = 1.0 / arr.Mean;
        var mu = 1.0 / svc.Mean;
        var rho = lambda / mu;

        var steps = new List<string>
        {
            $"λ = 1 / mean inter-arrival time = 1 / {F(arr.Mean)} = {F(lambda)} per {one}",
            $"μ = 1 / mean service time = 1 / {F(svc.Mean)} = {F(mu)} per {one}",
            $"ρ = λ / μ = {F(lambda)} / {F(mu)} = {F(rho)}"
        };

        if (rho >= 1.0)
        {
            throw new InvalidOperationException(
                $"The system is unstable: utilization ρ = {F(rho)} must be below 1. Lower the arrival rate or increase service speed.");
        }

        double lq;

        switch (model)
        {
            case "MM1":
                lq = Math.Pow(rho, 2) / (1.0 - rho);
                steps.Add($"Lq = ρ² / (1 - ρ) = {F(rho)}² / (1 - {F(rho)}) = {F(lq)}");
                steps.Add($"P0 = 1 - ρ = {F(1.0 - rho)}");
                break;

            case "MG1": // Pollaczek-Khinchine Formula
                var variance = Math.Pow(svc.Sd, 2);
                lq = (Math.Pow(lambda, 2) * variance + Math.Pow(rho, 2)) / (2.0 * (1.0 - rho));
                steps.Add($"σ² (service variance) = {F(svc.Sd)}² = {F(variance)}");
                steps.Add($"Lq = (λ²σ² + ρ²) / (2(1 - ρ)) = ({F(lambda)}² × {F(variance)} + {F(rho)}²) / (2 × (1 - {F(rho)})) = {F(lq)}");
                break;

            case "GG1": // Sakasegawa Single-Server Approximation (c = 1)
                var ca2 = Math.Pow(arr.Sd / arr.Mean, 2);
                var cs2 = Math.Pow(svc.Sd / svc.Mean, 2);
                var wqSakasegawa = (rho / (1.0 - rho)) * ((ca2 + cs2) / 2.0) * svc.Mean;
                lq = lambda * wqSakasegawa;
                steps.Add($"Ca² = (σa / mean)² = ({F(arr.Sd)} / {F(arr.Mean)})² = {F(ca2)}");
                steps.Add($"Cs² = (σs / mean)² = ({F(svc.Sd)} / {F(svc.Mean)})² = {F(cs2)}");
                steps.Add($"Wq ≈ [ρ / (1 - ρ)] × [(Ca² + Cs²) / 2] × (1/μ) = {F(wqSakasegawa)} {displayUnit}");
                steps.Add($"Lq = λ × Wq = {F(lambda)} × {F(wqSakasegawa)} = {F(lq)}");
                break;

            default:
                throw new ArgumentException("Unknown queue model.");
        }

        var wq = lq / lambda;
        var w = wq + (1.0 / mu);
        var l = lambda * w;

        steps.Add($"Wq = Lq / λ = {F(lq)} / {F(lambda)} = {F(wq)} {displayUnit}");
        steps.Add($"W = Wq + 1/μ = {F(wq)} + {F(svc.Mean)} = {F(w)} {displayUnit}");
        steps.Add($"L = λ × W = {F(lambda)} × {F(w)} = {F(l)} vehicles");

        var p0 = 1.0 - rho;

        var results = new List<QueueMetricItem>
        {
            new() { Key = "rho", Label = "Utilization (ρ)", Value = rho, Unit = string.Empty },
            new() { Key = "Lq", Label = "Mean Number in Queue (Lq)", Value = lq, Unit = string.Empty },
            new() { Key = "Wq", Label = "Mean Wait in Queue (Wq)", Value = wq, Unit = displayUnit },
            new() { Key = "L", Label = "Mean Number in System (L)", Value = l, Unit = string.Empty },
            new() { Key = "W", Label = "Mean Wait in System (W)", Value = w, Unit = displayUnit },
            new() { Key = "p0", Label = "Idle Probability (P0)", Value = p0, Unit = string.Empty }
        };

        return new QueueCalculationResponse
        {
            Model = model,
            Results = results,
            Steps = steps
        };
    }

    public SimulationResponse Simulate(SimulationRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        var model = request.Model?.Trim().ToUpperInvariant() ?? "MM1";
        if (model is not ("MM1" or "MM2"))
        {
            throw new ArgumentException("Unknown simulation model. Supported models are MM1 and MM2.");
        }

        var timeUnit = request.TimeUnit?.Trim().ToLowerInvariant() ?? "seconds";
        if (!Units.TryGetValue(timeUnit, out var timeUnitSeconds))
        {
            throw new ArgumentException("Unknown time unit. Supported units: seconds, minutes, hours.");
        }

        var customerCount = Math.Clamp(request.CustomerCount, 1, 500);

        var arr = ReadSide(request.Arrival, "Arrival", timeUnit, false);
        var svc = ReadSide(request.Service, "Service", timeUnit, false);

        var lambda = 1.0 / arr.Mean;
        var mu = 1.0 / svc.Mean;

        var rng = request.Seed.HasValue ? new Random(request.Seed.Value) : new Random();

        var rows = new List<SimulationTraceRow>();
        double currentArrivalClock = 0.0;
        int servers = model == "MM2" ? 2 : 1;

        double pump1FreeAt = 0.0;
        double pump2FreeAt = 0.0;
        double pump1BusyTime = 0.0;
        double pump2BusyTime = 0.0;

        for (int i = 1; i <= customerCount; i++)
        {
            double rArr = Math.Round(rng.NextDouble(), 5);
            if (rArr <= 0.00001) rArr = 0.00001;
            if (rArr >= 0.99999) rArr = 0.99999;

            double interArrival;
            if (i == 1)
            {
                interArrival = 0.0;
                currentArrivalClock = 0.0;
            }
            else
            {
                interArrival = Math.Round(-Math.Log(1.0 - rArr) / lambda, 2);
                if (interArrival < 0.01) interArrival = 0.01;
                currentArrivalClock = Math.Round(currentArrivalClock + interArrival, 2);
            }

            double rSvc = Math.Round(rng.NextDouble(), 5);
            if (rSvc <= 0.00001) rSvc = 0.00001;
            if (rSvc >= 0.99999) rSvc = 0.99999;

            double serviceTime = Math.Round(-Math.Log(1.0 - rSvc) / mu, 2);
            if (serviceTime < 0.01) serviceTime = 0.01;

            string assignedServer;
            double serviceStart;
            double serviceEnd;
            double idleTime = 0.0;

            if (servers == 1)
            {
                assignedServer = "Pump 1";
                if (currentArrivalClock >= pump1FreeAt)
                {
                    idleTime = Math.Round(currentArrivalClock - pump1FreeAt, 2);
                    serviceStart = currentArrivalClock;
                }
                else
                {
                    idleTime = 0.0;
                    serviceStart = pump1FreeAt;
                }
                serviceEnd = Math.Round(serviceStart + serviceTime, 2);
                pump1FreeAt = serviceEnd;
                pump1BusyTime += serviceTime;
            }
            else
            {
                // MM2: 2 parallel servers
                if (pump1FreeAt <= currentArrivalClock)
                {
                    assignedServer = "Pump 1";
                    idleTime = Math.Round(currentArrivalClock - pump1FreeAt, 2);
                    serviceStart = currentArrivalClock;
                    serviceEnd = Math.Round(serviceStart + serviceTime, 2);
                    pump1FreeAt = serviceEnd;
                    pump1BusyTime += serviceTime;
                }
                else if (pump2FreeAt <= currentArrivalClock)
                {
                    assignedServer = "Pump 2";
                    idleTime = Math.Round(currentArrivalClock - pump2FreeAt, 2);
                    serviceStart = currentArrivalClock;
                    serviceEnd = Math.Round(serviceStart + serviceTime, 2);
                    pump2FreeAt = serviceEnd;
                    pump2BusyTime += serviceTime;
                }
                else
                {
                    if (pump1FreeAt <= pump2FreeAt)
                    {
                        assignedServer = "Pump 1";
                        idleTime = 0.0;
                        serviceStart = pump1FreeAt;
                        serviceEnd = Math.Round(serviceStart + serviceTime, 2);
                        pump1FreeAt = serviceEnd;
                        pump1BusyTime += serviceTime;
                    }
                    else
                    {
                        assignedServer = "Pump 2";
                        idleTime = 0.0;
                        serviceStart = pump2FreeAt;
                        serviceEnd = Math.Round(serviceStart + serviceTime, 2);
                        pump2FreeAt = serviceEnd;
                        pump2BusyTime += serviceTime;
                    }
                }
            }

            double waitInQueue = Math.Round(Math.Max(0.0, serviceStart - currentArrivalClock), 2);
            double timeInSystem = Math.Round(serviceEnd - currentArrivalClock, 2);

            rows.Add(new SimulationTraceRow
            {
                CustomerId = i,
                RandomArrival = i == 1 ? 0.0 : rArr,
                InterArrivalTime = interArrival,
                ArrivalTime = currentArrivalClock,
                RandomService = rSvc,
                ServiceTime = serviceTime,
                AssignedServer = assignedServer,
                ServiceStartTime = serviceStart,
                ServiceEndTime = serviceEnd,
                WaitInQueue = waitInQueue,
                TimeInSystem = timeInSystem,
                ServerIdleTime = idleTime
            });
        }

        double totalSimTime = servers == 1 ? pump1FreeAt : Math.Max(pump1FreeAt, pump2FreeAt);
        if (totalSimTime <= 0) totalSimTime = 1.0;

        double simUtil = Math.Round((pump1BusyTime + pump2BusyTime) / (servers * totalSimTime), 4);
        double s1Util = Math.Round(pump1BusyTime / totalSimTime, 4);
        double? s2Util = servers == 2 ? Math.Round(pump2BusyTime / totalSimTime, 4) : null;

        double sumWait = rows.Sum(r => r.WaitInQueue);
        double sumSystem = rows.Sum(r => r.TimeInSystem);
        double sumInterArr = rows.Skip(1).Any() ? rows.Skip(1).Average(r => r.InterArrivalTime) : 0.0;
        double avgSvc = rows.Average(r => r.ServiceTime);

        double avgWq = Math.Round(sumWait / customerCount, 4);
        double avgW = Math.Round(sumSystem / customerCount, 4);
        double avgLq = Math.Round(sumWait / totalSimTime, 4);
        double avgL = Math.Round(sumSystem / totalSimTime, 4);

        int customersWaited = rows.Count(r => r.WaitInQueue > 0.001);
        double customersWaitedPct = Math.Round((double)customersWaited / customerCount * 100.0, 1);
        double maxWait = rows.Max(r => r.WaitInQueue);

        int maxQueue = 0;
        foreach (var r in rows)
        {
            int inQueueAtArrival = rows.Count(other => other.ArrivalTime <= r.ArrivalTime && other.ServiceStartTime > r.ArrivalTime);
            if (inQueueAtArrival > maxQueue) maxQueue = inQueueAtArrival;
        }

        double theoreticalRho;
        bool isStable;
        double? theoLq = null;
        double? theoWq = null;
        double? theoL = null;
        double? theoW = null;
        double? theoP0 = null;

        if (servers == 1)
        {
            theoreticalRho = lambda / mu;
            isStable = theoreticalRho < 1.0;
            if (isStable)
            {
                theoP0 = 1.0 - theoreticalRho;
                theoLq = Math.Pow(theoreticalRho, 2) / (1.0 - theoreticalRho);
                theoWq = theoLq.Value / lambda;
                theoW = theoWq.Value + (1.0 / mu);
                theoL = lambda * theoW.Value;
            }
        }
        else
        {
            double r = lambda / mu;
            theoreticalRho = r / 2.0;
            isStable = theoreticalRho < 1.0;
            if (isStable)
            {
                double p0Inv = 1.0 + r + (Math.Pow(r, 2) / (2.0 * (1.0 - theoreticalRho)));
                double p0 = 1.0 / p0Inv;
                theoP0 = p0;
                theoLq = (p0 * Math.Pow(r, 2) * theoreticalRho) / (2.0 * Math.Pow(1.0 - theoreticalRho, 2));
                theoWq = theoLq.Value / lambda;
                theoW = theoWq.Value + (1.0 / mu);
                theoL = theoLq.Value + r;
            }
        }

        return new SimulationResponse
        {
            Model = model,
            Servers = servers,
            CustomerCount = customerCount,
            TimeUnit = timeUnit,
            TotalSimulationTime = Math.Round(totalSimTime, 2),
            SimulatedUtilization = simUtil,
            Server1Utilization = s1Util,
            Server2Utilization = s2Util,
            AvgWaitQueue = avgWq,
            AvgTimeSystem = avgW,
            AvgQueueLength = avgLq,
            AvgNumberSystem = avgL,
            MaxWaitTime = Math.Round(maxWait, 2),
            MaxQueueLength = maxQueue,
            CustomersWaitedCount = customersWaited,
            CustomersWaitedPercent = customersWaitedPct,
            AvgInterArrivalTime = Math.Round(sumInterArr, 2),
            AvgServiceTime = Math.Round(avgSvc, 2),
            TheoreticalRho = Math.Round(theoreticalRho, 4),
            IsTheoreticalStable = isStable,
            TheoreticalLq = theoLq.HasValue ? Math.Round(theoLq.Value, 4) : null,
            TheoreticalWq = theoWq.HasValue ? Math.Round(theoWq.Value, 4) : null,
            TheoreticalL = theoL.HasValue ? Math.Round(theoL.Value, 4) : null,
            TheoreticalW = theoW.HasValue ? Math.Round(theoW.Value, 4) : null,
            TheoreticalP0 = theoP0.HasValue ? Math.Round(theoP0.Value, 4) : null,
            Rows = rows
        };
    }

    private static (double Mean, double Sd) ReadSide(SideInputModel? side, string name, string displayUnit, bool needSd)
    {
        if (side == null || !Units.TryGetValue(side.Unit ?? string.Empty, out var inputUnitSeconds))
        {
            throw new ArgumentException($"{name}: choose a valid time unit.");
        }

        if (side.Value is not > 0)
        {
            throw new ArgumentException($"{name}: the value must be greater than 0.");
        }

        if (needSd && side.Sd is not >= 0)
        {
            throw new ArgumentException($"{name}: enter the standard deviation (0 or more).");
        }

        var isRate = string.Equals(side.Type, "rate", StringComparison.OrdinalIgnoreCase);
        var meanSec = isRate ? (inputUnitSeconds / side.Value.Value) : (side.Value.Value * inputUnitSeconds);
        var sdSec = (side.Sd ?? 0.0) * inputUnitSeconds;

        var displayUnitSeconds = Units[displayUnit];
        return (meanSec / displayUnitSeconds, sdSec / displayUnitSeconds);
    }

    private static string F(double x) => Math.Round(x, 4).ToString(CultureInfo.InvariantCulture);
}
