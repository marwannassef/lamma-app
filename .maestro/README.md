# End-to-end flows (Maestro)

Install Maestro (`brew tap mobile-dev-inc/tap && brew install maestro`), start an emulator or
simulator with Lamma installed, then:

```bash
# A preview or store build (the app is bundled)
npm run e2e

# A development build: Metro must be running (npx expo start --dev-client)
maestro test -e DEV_URL=10.0.2.2:8081 .maestro
```

`10.0.2.2` is the host machine as seen from the Android emulator; use `localhost:8081` on the iOS simulator.
Flows clear Lamma's data before they run.
