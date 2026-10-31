namespace PetrolQueueCalculator.Models;

public class QueueCalculationRequest
{
    public string Model { get; set; } = string.Empty;
    public string DisplayUnit { get; set; } = "minutes";
    public SideInputModel? Arrival { get; set; }
    public SideInputModel? Service { get; set; }
}

public class SideInputModel
{
    public string Unit { get; set; } = "seconds";
    public string Type { get; set; } = "time"; // "time" or "rate"
    public double? Value { get; set; }
    public double? Sd { get; set; }
}
