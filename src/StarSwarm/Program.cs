using System.Text.Json;
using System.Text.RegularExpressions;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var store = new ScoreStore(Path.Combine(app.Environment.ContentRootPath, "App_Data", "scores.json"));

app.UseDefaultFiles();
app.UseStaticFiles();

// 랭킹 조회: 상위 10개
app.MapGet("/api/scores", () => store.Top(10));

// 랭킹 등록: 이름 1~3글자(A-Z, 0-9), 점수/스테이지 범위 검증
app.MapPost("/api/scores", (ScoreEntry entry) =>
{
    var name = (entry.Name ?? "").Trim().ToUpperInvariant();
    if (!Regex.IsMatch(name, "^[A-Z0-9 .]{1,3}$")) return Results.BadRequest("invalid name");
    if (entry.Score is < 0 or > 99_999_990) return Results.BadRequest("invalid score");
    if (entry.Stage is < 1 or > 999) return Results.BadRequest("invalid stage");
    store.Add(entry with { Name = name });
    return Results.Ok(store.Top(10));
});

app.Run();

record ScoreEntry(string Name, int Score, int Stage);

// JSON 파일에 점수를 저장하는 아주 단순한 저장소
class ScoreStore
{
    private readonly string _path;
    private readonly object _lock = new();
    private List<ScoreEntry> _scores;

    public ScoreStore(string path)
    {
        _path = path;
        try { _scores = JsonSerializer.Deserialize<List<ScoreEntry>>(File.ReadAllText(path)) ?? []; }
        catch { _scores = []; }
    }

    public List<ScoreEntry> Top(int n)
    {
        lock (_lock) return _scores.OrderByDescending(s => s.Score).Take(n).ToList();
    }

    public void Add(ScoreEntry entry)
    {
        lock (_lock)
        {
            _scores.Add(entry);
            _scores = _scores.OrderByDescending(s => s.Score).Take(100).ToList();
            Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
            File.WriteAllText(_path, JsonSerializer.Serialize(_scores));
        }
    }
}
