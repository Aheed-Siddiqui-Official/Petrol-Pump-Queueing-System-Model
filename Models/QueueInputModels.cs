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

public class SimulationRequest
{
    public string Model { get; set; } = "MM1"; // "MM1" or "MM2"
    public int CustomerCount { get; set; } = 10;
    public string TimeUnit { get; set; } = "seconds";
    public SideInputModel? Arrival { get; set; }
    public SideInputModel? Service { get; set; }
    public int? Seed { get; set; }
}
