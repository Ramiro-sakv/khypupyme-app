FROM node:24-bookworm-slim AS web
WORKDIR /source/web
RUN npm install --global pnpm@11.25.0
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS server
WORKDIR /source
COPY global.json ./
COPY server/ server/
RUN dotnet restore server/KhypuPyme.Api/KhypuPyme.Api.csproj --locked-mode
RUN dotnet publish server/KhypuPyme.Api/KhypuPyme.Api.csproj -c Release --no-restore -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=server /out/ ./
COPY --from=web /source/web/dist/ ./wwwroot/
ENV ASPNETCORE_URLS=http://0.0.0.0:10000
EXPOSE 10000
USER $APP_UID
ENTRYPOINT ["dotnet", "KhypuPyme.Api.dll"]
