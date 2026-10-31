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

public class ErrorResponse
{
    [JsonPropertyName("error")]
    public string Error { get; set; } = string.Empty;
}
