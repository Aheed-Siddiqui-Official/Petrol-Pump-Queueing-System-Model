using PetrolQueueCalculator.Models;

namespace PetrolQueueCalculator.Services;

public interface IQueueSimulationService
{
    QueueCalculationResponse Calculate(QueueCalculationRequest request);
    SimulationResponse Simulate(SimulationRequest request);
    PetrolDataPreset GetPresetData();
}
