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
        double? p0 = null;

        switch (model)
        {
            case "MM1":
                lq = Math.Pow(rho, 2) / (1.0 - rho);
                p0 = 1.0 - rho;
                steps.Add($"Lq = ρ² / (1 - ρ) = {F(rho)}² / (1 - {F(rho)}) = {F(lq)}");
                steps.Add($"P0 = 1 - ρ = {F(p0.Value)}");
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

        var results = new List<QueueMetricItem>
        {
            new() { Key = "meanIa", Label = "Mean inter-arrival time", Value = arr.Mean, Unit = displayUnit },
            new() { Key = "meanSv", Label = "Mean service time", Value = svc.Mean, Unit = displayUnit },
            new() { Key = "lambda", Label = "Arrival rate (λ)", Value = lambda, Unit = $"per {one}" },
            new() { Key = "mu", Label = "Service rate (μ)", Value = mu, Unit = $"per {one}" },
            new() { Key = "rho", Label = "Utilization (ρ)", Value = rho, Unit = string.Empty },
            new() { Key = "L", Label = "Vehicles in system (L)", Value = l, Unit = string.Empty },
            new() { Key = "Lq", Label = "Vehicles in queue (Lq)", Value = lq, Unit = string.Empty },
            new() { Key = "W", Label = "Time in system (W)", Value = w, Unit = displayUnit },
            new() { Key = "Wq", Label = "Waiting time (Wq)", Value = wq, Unit = displayUnit }
        };

        if (p0.HasValue)
        {
            results.Add(new() { Key = "p0", Label = "System empty (P0)", Value = p0.Value, Unit = string.Empty });
        }

        return new QueueCalculationResponse
        {
            Model = model,
            Results = results,
            Steps = steps
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
