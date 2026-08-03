// swift-tools-version: 5.8

/* LetterMyComic for iPad — Swift Playgrounds app package.

   This builds WITHOUT a Mac: open this .swiftpm folder in the free
   Swift Playgrounds app on an iPad (Playgrounds 4.2+), press Run to
   try it, and use App Settings → "Upload to App Store Connect" to
   submit — the whole path runs on the iPad.

   Before uploading, set `teamIdentifier` below to your Apple Developer
   Team ID (App Store Connect → Membership). */

import PackageDescription
import AppleProductTypes

let package = Package(
    name: "LetterMyComic",
    platforms: [
        .iOS("16.0")
    ],
    products: [
        .iOSApplication(
            name: "LetterMyComic",
            targets: ["AppModule"],
            bundleIdentifier: "com.lettermycomic.app",
            teamIdentifier: "",
            displayVersion: "1.0",
            bundleVersion: "1",
            appIcon: .placeholder(icon: .pencil),
            accentColor: .presetColor(.orange),
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                .portrait,
                .landscapeRight,
                .landscapeLeft
            ]
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: "."
        )
    ]
)
