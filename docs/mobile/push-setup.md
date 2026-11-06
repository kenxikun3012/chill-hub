# Testing push notifications on Android

Push doesn't work in Expo Go on Android, so testing it takes a development build. It only needs setting up once. Everything else in the app still works in Expo Go, just without push.

These steps need your own Expo and Firebase accounts. Both are free. Run the commands from `apps/mobile`, using `npx.cmd` instead of `npx` in PowerShell. If a command's prompts differ from this guide, the [Expo push setup guide](https://docs.expo.dev/push-notifications/push-notifications-setup/) has the current steps.

## 1. Link the project to Expo

Create an account at [expo.dev](https://expo.dev), then:

```bash
npx eas-cli login
npx eas-cli init
```

`init` adds a project ID to `app.json`. Commit that change.

## 2. Create the Firebase project

1. In the [Firebase console](https://console.firebase.google.com), create a project.
2. Add an **Android app** with the package name `com.chillhub.app` (it's in `app.json`).
3. Download `google-services.json`.
4. Give it to EAS as a file variable, and keep it out of git:

```bash
npx eas-cli env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment development
```

## 3. Let Expo send through Firebase

1. In Firebase, open **Project settings > Service accounts** and generate a new private key. This file is a secret: never commit it.
2. Upload it to Expo, choosing **Android**, the **development** profile, then **Google Service Account > FCM V1**:

```bash
npx eas-cli credentials
```

## 4. Build and install

```bash
npx eas-cli build --profile development --platform android
```

When it finishes, open the link on your phone and install the APK. You only need a new build when native packages change.

## 5. Run it

Start the API and the dev server, on the same Wi-Fi as the phone:

```bash
npm run api:dev
```

```bash
npm run app:dev
```

Open the installed **Chill Hub** app, not Expo Go, and connect to the dev server. Log in as an approved player and allow notifications.

## 6. Check it works

1. From another account, send a join request to a lobby you host, with your phone's app closed. An alert should arrive within a few seconds.
2. Tap it. The lobby should open.
3. In notification settings, turn Lobbies push off and repeat. No alert should arrive.

## iOS

Real iPhone push needs a paid Apple Developer account (about US$99 a year). The app code is the same, so this can wait until there's an iOS release.
