using PetrolQueueCalculator.Services;

var builder = WebApplication.CreateBuilder(args);

// Register API controllers, Razor Pages, and queue simulation services
builder.Services.AddControllers();
builder.Services.AddRazorPages();
builder.Services.AddScoped<IQueueSimulationService, QueueSimulationService>();

// Enable CORS for flexibility
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure static files from wwwroot/
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseRouting();
app.UseCors();

// Map both API controllers and Razor Pages
app.MapControllers();
app.MapRazorPages();

app.Run();
