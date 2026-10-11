# Changelog

## [1.4.0](https://github.com/armselig/klankern-2026/compare/v1.3.1...v1.4.0) (2026-10-11)

### Features

* **recipes:** share recipes and put their ingredients on the shopping list ([7a02601](https://github.com/armselig/klankern-2026/commit/7a0260199b67a3b6a4a17e7d3bfa63d571cda8dc))

### Bug Fixes

* **lists:** create a household's to-do and shopping list only once ([165ecec](https://github.com/armselig/klankern-2026/commit/165ececdf5d979e7ef7d8423de80b410da5dad32))

## [1.3.1](https://github.com/armselig/klankern-2026/compare/v1.3.0...v1.3.1) (2026-10-11)

### Reverts

* feat(fonts): ship Bitter, Nunito Sans and JetBrains Mono ([7dc8c86](https://github.com/armselig/klankern-2026/commit/7dc8c86fdf0030d56b0c674d110abad38a260766))

## [1.3.0](https://github.com/armselig/klankern-2026/compare/v1.2.0...v1.3.0) (2026-10-11)

### Features

* **fonts:** ship Bitter, Nunito Sans and JetBrains Mono ([0753a42](https://github.com/armselig/klankern-2026/commit/0753a42681c1b7d1ed3069e06634ad2b7e75d88b))

## [1.2.0](https://github.com/armselig/klankern-2026/compare/v1.1.0...v1.2.0) (2026-10-11)

### Features

* **theme:** add Catppuccin light and dark mode ([1b341fe](https://github.com/armselig/klankern-2026/commit/1b341fe27721e08c81fe6f0ba56433d56f5246b6))

## [1.1.0](https://github.com/armselig/klankern-2026/compare/v1.0.0...v1.1.0) (2026-10-11)

### Features

* **avatars:** show an avatar for every user, from Gravatar ([807db86](https://github.com/armselig/klankern-2026/commit/807db86c808c93fb7d5bebc10092bb3dbafc7e25))
* **header:** add a wordmark heading and an account menu ([b156164](https://github.com/armselig/klankern-2026/commit/b15616458448fee1031cb5ec4ca2412fbbf57044))

### Bug Fixes

* **ui:** keep the contrast of hovered and focused controls on the primary color ([7b2a584](https://github.com/armselig/klankern-2026/commit/7b2a5844c19a750b0aec0b46c5acfcfc525b0fb8))

## 1.0.0 (2026-10-10)

### Features

* **deploy:** build for Netlify as a static site ([65bb9fb](https://github.com/armselig/klankern-2026/commit/65bb9fbae8fcd588213fcbcb653e42536ec5222d))
* **layout:** add footer component ([a34e4d6](https://github.com/armselig/klankern-2026/commit/a34e4d6aefdf53e9d9333cf43377a7c000c01f3b))
* **layout:** show the app version in the footer ([d412c4a](https://github.com/armselig/klankern-2026/commit/d412c4afe14ed3714bf5448b808e5856d69bb672))
* **layout:** show the signed-in user or a login button in the header ([ddec75f](https://github.com/armselig/klankern-2026/commit/ddec75fe695d5c63abef4a9946b9654e11d4d24c))
* scaffold Klankern PWA with auth, household, and to-do milestones ([d3f3ba9](https://github.com/armselig/klankern-2026/commit/d3f3ba9595028e4d5ceed727588c20b455338f90))
* **shopping:** add the shared shopping list with live sync ([a23a42b](https://github.com/armselig/klankern-2026/commit/a23a42bc036a9701b358be88e11cbf02b2e3e89a))
* **todos:** sync to-dos live between household members via Realtime ([d42ce08](https://github.com/armselig/klankern-2026/commit/d42ce085a8ac7a4875ae247c9fec7c4032948898))
* **ui:** use SVG icons from Material Design Icons v7 ([558f8ac](https://github.com/armselig/klankern-2026/commit/558f8acd1eee47b3715c58301b40b3d62f0d78e5))
* **whiteboard:** add a shared whiteboard per household ([5d682a5](https://github.com/armselig/klankern-2026/commit/5d682a543585e880384f437886054214b9458b2d))

### Bug Fixes

* **a11y:** give every page a title and raise the grey text contrast ([015635c](https://github.com/armselig/klankern-2026/commit/015635c1a377a8dddd91fe0d384f24b9b114ce98))
* **db:** create households and invites via security definer RPCs ([7b5303d](https://github.com/armselig/klankern-2026/commit/7b5303d09778784aa4b7dd79a2930c40694f0d35))
* **db:** restrict execute on public functions to authenticated users ([0345e02](https://github.com/armselig/klankern-2026/commit/0345e022fa15ec27ea0d4d5543b0598b7a2665fc))
* **deploy:** serve the web manifest with its own content type ([3e5f55f](https://github.com/armselig/klankern-2026/commit/3e5f55f47b7129209b046d367031164e77f4d867))
* keep list changes made while an add is saving, and show real error messages ([d9c1fd7](https://github.com/armselig/klankern-2026/commit/d9c1fd7a093f80f214e730284192058c4551a709))
* **lists:** drop Realtime events that arrive out of commit order ([83fea55](https://github.com/armselig/klankern-2026/commit/83fea55a69950b33f62941b418d547a00b3afde1))
* **lists:** keep changes made while a resync fetch is in flight ([f855ef7](https://github.com/armselig/klankern-2026/commit/f855ef7c7c8f930bb3332d27982eba7be3bec327))
* **pwa:** make the app installable and the offline page work ([2d00083](https://github.com/armselig/klankern-2026/commit/2d00083d2a9d40dd331c2abeea22b98a4e221b2e))
* **pwa:** remove the build-info glob pattern instead of ignoring its files ([f7be317](https://github.com/armselig/klankern-2026/commit/f7be317e425f8505c6a88fd1f13639de110eff89))
* reset the stores when the signed-in user changes ([10e9007](https://github.com/armselig/klankern-2026/commit/10e9007b48d52d68a524cb1964cd647ea59ae6af))
* resolve issues found in the milestone 3-4 click-through ([2102be2](https://github.com/armselig/klankern-2026/commit/2102be2b455c8b5b02cdadca2ad5197b86635e8e))
* **todos:** read user id from JWT claims when adding a to-do ([9e3b1bd](https://github.com/armselig/klankern-2026/commit/9e3b1bdcbcb474a90fd68b0eaf1d8630b9a1c782))
