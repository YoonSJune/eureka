// 게임 파일(wwwroot)만 제공하는 정적 웹 서버. 랭킹은 브라우저가 Supabase에 직접 저장합니다.
var app = WebApplication.CreateBuilder(args).Build();
app.UseDefaultFiles();
app.UseStaticFiles();
app.Run();
