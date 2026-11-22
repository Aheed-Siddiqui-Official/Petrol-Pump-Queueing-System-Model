using System.Text.Json.Serialization;

namespace PetrolQueueCalculator.Models;

public class QueueCalculationResponse
{
    [JsonPropertyName("model")]
    public string Model { get; set; } = string.Empty;

    [JsonPropertyName("results")]
    public List<QueueMetricItem> Results { get; set; } = new();

    [JsonPropertyName("steps")]
    public List<string> Steps { get; set; } = new();
}

public class QueueMetricItem
{
    [JsonPropertyName("key")]
    public string Key { get; set; } = string.Empty;

    [JsonPropertyName("label")]
    public string Label { get; set; } = string.Empty;

    [JsonPropertyName("value")]
    public double Value { get; set; }

    [JsonPropertyName("unit")]
    public string Unit { get; set; } = string.Empty;
}

public class SimulationResponse
{
    [JsonPropertyName("model")]
    public string Model { get; set; } = "MM1";

    [JsonPropertyName("servers")]
    public int Servers { get; set; } = 1;

    [JsonPropertyName("customerCount")]
    public int CustomerCount { get; set; }

    [JsonPropertyName("timeUnit")]
    public string TimeUnit { get; set; } = "seconds";

    [JsonPropertyName("totalSimulationTime")]
    public double TotalSimulationTime { get; set; }

    [JsonPropertyName("simulatedUtilization")]
    public double SimulatedUtilization { get; set; }

    [JsonPropertyName("server1Utilization")]
    public double? Server1Utilization { get; set; }

    [JsonPropertyName("server2Utilization")]
    public double? Server2Utilization { get; set; }

    [JsonPropertyName("avgWaitQueue")]
    public double AvgWaitQueue { get; set; }

    [JsonPropertyName("avgTimeSystem")]
    public double AvgTimeSystem { get; set; }

    [JsonPropertyName("avgQueueLength")]
    public double AvgQueueLength { get; set; }

    [JsonPropertyName("avgNumberSystem")]
    public double AvgNumberSystem { get; set; }

    [JsonPropertyName("maxWaitTime")]
    public double MaxWaitTime { get; set; }

    [JsonPropertyName("maxQueueLength")]
    public int MaxQueueLength { get; set; }

    [JsonPropertyName("customersWaitedCount")]
    public int CustomersWaitedCount { get; set; }

    [JsonPropertyName("customersWaitedPercent")]
    public double CustomersWaitedPercent { get; set; }

    [JsonPropertyName("avgInterArrivalTime")]
    public double AvgInterArrivalTime { get; set; }

    [JsonPropertyName("avgServiceTime")]
    public double AvgServiceTime { get; set; }

    // Theoretical Comparison
    [JsonPropertyName("theoreticalRho")]
    public double TheoreticalRho { get; set; }

    [JsonPropertyName("isTheoreticalStable")]
    public bool IsTheoreticalStable { get; set; }

    [JsonPropertyName("theoreticalLq")]
    public double? TheoreticalLq { get; set; }

    [JsonPropertyName("theoreticalWq")]
    public double? TheoreticalWq { get; set; }

    [JsonPropertyName("theoreticalL")]
    public double? TheoreticalL { get; set; }

    [JsonPropertyName("theoreticalW")]
    public double? TheoreticalW { get; set; }

    [JsonPropertyName("theoreticalP0")]
    public double? TheoreticalP0 { get; set; }

    [JsonPropertyName("rows")]
    public List<SimulationTraceRow> Rows { get; set; } = new();
}

public class SimulationTraceRow
{
    [JsonPropertyName("customerId")]
    public int CustomerId { get; set; }

    [JsonPropertyName("randomArrival")]
    public double RandomArrival { get; set; }

    [JsonPropertyName("interArrivalTime")]
    public double InterArrivalTime { get; set; }

    [JsonPropertyName("arrivalTime")]
    public double ArrivalTime { get; set; }

    [JsonPropertyName("randomService")]
    public double RandomService { get; set; }

    [JsonPropertyName("serviceTime")]
    public double ServiceTime { get; set; }

    [JsonPropertyName("assignedServer")]
    public string AssignedServer { get; set; } = "Pump 1";

    [JsonPropertyName("serviceStartTime")]
    public double ServiceStartTime { get; set; }

    [JsonPropertyName("serviceEndTime")]
    public double ServiceEndTime { get; set; }

    [JsonPropertyName("waitInQueue")]
    public double WaitInQueue { get; set; }

    [JsonPropertyName("timeInSystem")]
    public double TimeInSystem { get; set; }

    [JsonPropertyName("serverIdleTime")]
    public double ServerIdleTime { get; set; }
}

public class ErrorResponse
{
    [JsonPropertyName("error")]
    public string Error { get; set; } = string.Empty;
}
