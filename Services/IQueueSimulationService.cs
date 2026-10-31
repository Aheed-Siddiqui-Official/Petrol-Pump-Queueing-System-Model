using PetrolQueueCalculator.Models;

namespace PetrolQueueCalculator.Services;

public interface IQueueSimulationService
{
    QueueCalculationResponse Calculate(QueueCalculationRequest request);
    PetrolDataPreset GetPresetData();
}
