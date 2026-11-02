# 1단계: 빌드
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY src/StarSwarm/ .
RUN dotnet publish -c Release -o /app

# 2단계: 실행 (가벼운 런타임 이미지)
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "StarSwarm.dll"]
