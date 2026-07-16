# Instagram Publishing Certification

Test cases for issue [#349](https://github.com/reza96ah-ship-it/publish/issues/349) — Week 3.
All test runs require a connected non-tester Business or Creator account (TC-CONN-01 complete).

## Pre-publication minimums (gate for pilot launch)
| Requirement | Target | Actual |
|---|:---:|:---:|
| Successful image publications | ≥10 | |
| Successful video/Reel publications | ≥10 | |
| Successful carousel publications | ≥10 | |
| Scheduled publications (within 60s) | ≥10 | |
| Known duplicate external posts | 0 | |
| Silently lost accepted publications | 0 | |
| Publications stuck in unknown state | 0 | |

## Test case index

### IMAGE
| Test | Description | Status |
|---|---|:---:|
| [TC-PUB-IMG-01](image/TC-PUB-IMG-01.md) | Standard JPEG 1:1 with caption and hashtags | ⬜ |
| [TC-PUB-IMG-02](image/TC-PUB-IMG-02.md) | PNG at max file size (8 MB) | ⬜ |
| [TC-PUB-IMG-03](image/TC-PUB-IMG-03.md) | Wrong aspect ratio → rejected before provider call | ⬜ |
| [TC-PUB-IMG-04](image/TC-PUB-IMG-04.md) | Scheduled publish (dispatch at scheduled time ± 60s) | ⬜ |

### VIDEO
| Test | Description | Status |
|---|---|:---:|
| [TC-PUB-VID-01](video/TC-PUB-VID-01.md) | MP4, valid duration and size | ⬜ |
| [TC-PUB-VID-02](video/TC-PUB-VID-02.md) | Video at duration limit | ⬜ |
| [TC-PUB-VID-03](video/TC-PUB-VID-03.md) | Invalid codec → rejected at validation | ⬜ |
| [TC-PUB-VID-04](video/TC-PUB-VID-04.md) | Scheduled publish | ⬜ |

### REEL
| Test | Description | Status |
|---|---|:---:|
| [TC-PUB-REEL-01](reel/TC-PUB-REEL-01.md) | Valid Reel (3–90s, 9:16) | ⬜ |
| [TC-PUB-REEL-02](reel/TC-PUB-REEL-02.md) | Cover image included | ⬜ |
| [TC-PUB-REEL-03](reel/TC-PUB-REEL-03.md) | Share to feed: true vs false | ⬜ |

### CAROUSEL
| Test | Description | Status |
|---|---|:---:|
| [TC-PUB-CAR-01](carousel/TC-PUB-CAR-01.md) | 2-image carousel | ⬜ |
| [TC-PUB-CAR-02](carousel/TC-PUB-CAR-02.md) | 10-image carousel (maximum) | ⬜ |
| [TC-PUB-CAR-03](carousel/TC-PUB-CAR-03.md) | Mixed image + video carousel | ⬜ |
| [TC-PUB-CAR-04](carousel/TC-PUB-CAR-04.md) | Carousel with ordered media (verify order preserved) | ⬜ |
| [TC-PUB-CAR-05](carousel/TC-PUB-CAR-05.md) | Missing child media → validation rejects | ⬜ |

Update status: ✅ PASS · ❌ FAIL · ⚠️ PARTIAL · ⬜ Not run

## Required state sequence (every publication)
`DRAFT → SCHEDULED? → QUEUED → PUBLISHING → PROVIDER_ACKNOWLEDGED → PUBLISHED`

Failure paths: `FAILED`, `ACTION_REQUIRED`, `OUTCOME_UNKNOWN`, `RECONNECT_REQUIRED`

No state may claim provider success without a provider-confirmed media ID.
