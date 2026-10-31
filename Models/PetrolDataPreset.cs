using System.Text.Json.Serialization;

namespace PetrolQueueCalculator.Models;

public class PetrolDataPreset
{
    [JsonPropertyName("vehicles")]
    public int Vehicles { get; set; } = 300;

    [JsonPropertyName("days")]
    public int Days { get; set; } = 6;

    [JsonPropertyName("interArrival")]
    public DistributionMetric InterArrival { get; set; } = new(40.146259, 23.537981);

    [JsonPropertyName("service")]
    public DistributionMetric Service { get; set; } = new(39.943333, 23.451796);
}

public class DistributionMetric
{
    [JsonPropertyName("meanSec")]
    public double MeanSec { get; set; }

    [JsonPropertyName("sdSec")]
    public double SdSec { get; set; }

    public DistributionMetric(double meanSec, double sdSec)
    {
        MeanSec = meanSec;
        SdSec = sdSec;
    }
}
