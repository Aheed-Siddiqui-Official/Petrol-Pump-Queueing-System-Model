using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using PetrolQueueCalculator.Models;
using PetrolQueueCalculator.Services;

namespace PetrolQueueCalculator.Pages;

public class IndexModel : PageModel
{
    private readonly IQueueSimulationService _queueService;

    public IndexModel(IQueueSimulationService queueService)
    {
        _queueService = queueService;
    }

    [BindProperty]
    public QueueCalculationRequest CalculationRequest { get; set; } = new()
    {
        Model = "GG1",
        DisplayUnit = "minutes",
        Arrival = new SideInputModel { Unit = "seconds", Type = "time", Value = 40.15, Sd = 23.54 },
        Service = new SideInputModel { Unit = "seconds", Type = "time", Value = 39.94, Sd = 23.45 }
    };

    public QueueCalculationResponse? CalculationResponse { get; set; }
    public string? ErrorMessage { get; set; }

    public void OnGet()
    {
    }

    public IActionResult OnPost()
    {
        try
        {
            CalculationResponse = _queueService.Calculate(CalculationRequest);
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }

        return Page();
    }
}
