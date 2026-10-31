using PetrolQueueCalculator.Services;

var builder = WebApplication.CreateBuilder(args);

// Register controllers and simulation services
builder.Services.AddControllers();
builder.Services.AddScoped<IQueueSimulationService, QueueSimulationService>();

// Enable CORS for local development flexibility
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

// Configure static files serving from wwwroot/
// UseDefaultFiles enables serving index.html when browsing to root "/"
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseRouting();
app.UseCors();

app.MapControllers();

app.Run();
