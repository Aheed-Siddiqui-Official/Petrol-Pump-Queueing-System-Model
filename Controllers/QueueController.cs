using Microsoft.AspNetCore.Mvc;
using PetrolQueueCalculator.Models;
using PetrolQueueCalculator.Services;

namespace PetrolQueueCalculator.Controllers;

[ApiController]
[Route("api")]
public class QueueController : ControllerBase
{
    private readonly IQueueSimulationService _queueService;

    public QueueController(IQueueSimulationService queueService)
    {
        _queueService = queueService;
    }

    /// <summary>
    /// Executes the specified single-server queue calculation (M/M/1, M/G/1, G/G/1)
    /// </summary>
    [HttpPost("calculate")]
    [ProducesResponseType(typeof(QueueCalculationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public IActionResult Calculate([FromBody] QueueCalculationRequest request)
    {
        try
        {
            var response = _queueService.Calculate(request);
            return Ok(response);
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return BadRequest(new ErrorResponse { Error = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new ErrorResponse { Error = $"An unexpected error occurred: {ex.Message}" });
        }
    }

    /// <summary>
    /// Returns baseline empirical metrics from the 300-vehicle dataset
    /// </summary>
    [HttpGet("petrol-data")]
    [ProducesResponseType(typeof(PetrolDataPreset), StatusCodes.Status200OK)]
    public IActionResult GetPetrolData()
    {
        return Ok(_queueService.GetPresetData());
    }
}
