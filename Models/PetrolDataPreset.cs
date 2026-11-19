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

    [JsonPropertyName("chiSquareTest")]
    public ChiSquareSummary ChiSquareTest { get; set; } = new();
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

public class ChiSquareSummary
{
    [JsonPropertyName("distributionTested")]
    public string DistributionTested { get; set; } = "Poisson";

    [JsonPropertyName("intervals")]
    public int Intervals { get; set; } = 37;

    [JsonPropertyName("intervalMinutes")]
    public int IntervalMinutes { get; set; } = 5;

    [JsonPropertyName("lambdaEstimated")]
    public double LambdaEstimated { get; set; } = 7.5405;

    [JsonPropertyName("sampleVariance")]
    public double SampleVariance { get; set; } = 2.0886;

    [JsonPropertyName("chiSquareCalculated")]
    public double ChiSquareCalculated { get; set; } = 19.5265;

    [JsonPropertyName("chiSquareCritical")]
    public double ChiSquareCritical { get; set; } = 9.4877;

    [JsonPropertyName("degreesOfFreedom")]
    public int DegreesOfFreedom { get; set; } = 4;

    [JsonPropertyName("pValue")]
    public double PValue { get; set; } = 0.000619;

    [JsonPropertyName("decision")]
    public string Decision { get; set; } = "Reject H0 (Poisson Rejected)";

    [JsonPropertyName("bestFitModel")]
    public string BestFitModel { get; set; } = "G/G/1";
}
