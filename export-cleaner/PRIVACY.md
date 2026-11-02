# Privacy and personal data: working notes

Last source review: **2026-11-02**. Product name: **Syca** (working name; repository name: Export Cleaner).

These are internal product and engineering notes. They record the intended privacy direction, current evidence, and unfinished checks. They are not a public privacy policy or a finding of legal compliance. Keep verified behaviour separate from proposed requirements and untested assumptions.

## Product direction

Ryan wants privacy to be a core consideration, including sensitive personal information and confidential client work. Assume a selected folder could contain private photographs, identity documents, financial or medical information, unpublished work, or information about other people.

- Preserve the existing project rule: core file analysis happens on the user's device. Any feature that sends file content elsewhere must be explicitly opt-in.
- The working requirement is that user files and information extracted from them are not used to train or fine-tune models. Any proposed change needs a deliberate product decision and a review of disclosures before implementation.
- Treat thumbnails, extracted text, metadata, filenames, file paths, and embeddings (numerical representations used for matching) as potentially sensitive too. A derived representation is not automatically anonymous.
- Useful local storage, such as saved scan progress, needs a defined purpose, retention behaviour, and a way for users to clear it.
- Request access only to the folders needed for the feature. Preserve the existing review and confirmation step before moving files.

## What the current code shows

This is a source review, not a runtime network audit. Recheck it when the relevant code or dependencies change.

| Area | Evidence in the current implementation | Remaining uncertainty |
| --- | --- | --- |
| Folder access | `src/scan.js` opens a user-selected folder read-only. The intro also accepts one dropped directory using `getAsFileSystemHandle()` and sends it through the existing `readFolder` / analysis pipeline. Files and multiple dropped items are rejected. Loaded runs ignore additional drops and suppress default file navigation. `src/main.js` requests write access at Apply. | Native Finder drag still needs end-to-end verification; synthetic drop/picker routing passed. Desktop permissions and folder watching are future work. |
| Image analysis | `src/embed.js` runs `onnx-community/dinov2-small` through Transformers.js using WebGPU or local WebAssembly execution. | Verify the actual outgoing requests and exact downloaded model revision. |
| Media type description | `src/media.js` matches the start screen's typed description against local keyword lists. If none fit, it runs `Xenova/all-MiniLM-L6-v2` (quantised, 23.5 MB) through Transformers.js on local WebAssembly to pick the closest type. The model downloads from Hugging Face the first time and is cached; the typed text is processed in the page and kept in memory (`state.description`) only. | Verify the outgoing requests on a cold cache and the exact model revision. |
| Text and PDFs | `src/ocr.js` uses a Tesseract.js worker; `src/pdf.js` passes local file bytes to pdf.js. | Audit library requests and storage as well as our wrapper code. |
| Training and uploads | No training/fine-tuning step or file-upload path was found in the app source checked. | This does not establish the behaviour of every dependency or future deployment. |
| Scan state | `src/main.js` holds file handles, previews, extracted information, families, and decisions in memory. No app-level save-progress database was found. | Inspect browser/worker storage before making claims about retention. Memory use is not a promise that the OS never writes temporary data. |
| Model/resource caching | The loading pipeline explicitly prepares the same model before per-file analysis, using its existing download/cache path. Transformers.js caches downloaded resources; Tesseract.js downloads and caches its language data. | Distinguish cached processing resources from cached user content; confirm what is actually stored. |
| External connections | The current setup downloads models from Hugging Face and OCR resources from jsDelivr; the app itself is served by its host. | Record actual destinations and request metadata. Download providers/hosts may receive IP addresses and other connection information. |
| Fonts | Instrument Sans and EB Garamond are bundled as local WOFF2 files in `src/fonts/`, with normal and italic styles. `src/style.css` uses relative font URLs; no Google Fonts stylesheet, preconnect, or runtime font CDN was added. | Fonts will be served by the app's host when used. The broader runtime network audit remains open. |
| Loading UI | Progress, throughput estimates and fact rotation are computed locally. The new loading controller adds no storage or network requests. | This is source evidence, not a completed runtime network audit. |
| Diagnostics | No analytics or remote crash-reporting integration was found in the checked app source. Existing console warnings/errors can include filenames and error details. | Review/redact these before connecting any remote reporting service. |
| Changes to files | `src/apply.js` moves explicit rejects into `_to_delete`, with a copy-then-remove fallback. | This is not secure erasure or a retention policy for user originals; the user controls those files. |

## Models: inference, licensing, and data use

**Inference** means using an already-trained model to analyse a file. **Training** means changing what a model has learned using examples. The current matching code performs inference. Downloading a model for local execution does not itself send the user's files to its creator.

Review each model or processing library along these separate dimensions:

1. **Where computation happens:** device, our server, or another provider.
2. **What is transmitted:** include file contents and derived data, not just full originals.
3. **What is retained or reused:** logs, backups, human access, retention periods, and training/fine-tuning terms.
4. **Permission to distribute/use it commercially:** check the exact model weights, conversion, libraries, attribution/notice requirements, and any restrictions.

The media-type text model, `sentence-transformers/all-MiniLM-L6-v2`, is listed under Apache 2.0; the app uses the Xenova ONNX conversion, whose notices also still need documenting.

DINOv2's upstream model is listed under Apache 2.0. The app uses the ONNX Community conversion, whose exact assets and applicable notices still need to be documented before distribution. Upstream licensing is not a completed review of everything bundled with the app.

**No training**, **no upload**, **no remote storage**, and **works offline** are different claims. Verify each independently. A provider can exclude requests from training while still storing them in logs.

## Proposed launch requirements

These are working requirements to resolve and verify before a public release, rather than descriptions of checks already passed.

- Keep the core grouping, comparison, and text extraction on the user's device.
- Keep file contents and derived information out of remote analytics, crash reports, and support logs by default. A user sending a diagnostic report should be able to understand and review what it contains.
- Define local caches and saved progress before building persistence: what is stored, where, how long, how it is cleared, and what happens when access is revoked or the app is removed.
- Review model/dependency updates for changes to downloads, network behaviour, persistence, and licence terms.
- For the installed desktop app, evaluate bundling the model and processing resources so core analysis can run without third-party runtime downloads. Verify offline behaviour rather than assuming it.
- Any future cloud-assisted naming or similarity judge needs a clear, separate opt-in and a review of the specific provider's data terms. Consider whether users are authorised to share information about clients or other people; a toggle alone does not establish that authority.
- If a cloud feature is added, revise broad privacy claims to identify which features remain local. Account for uploads that occur on failure/retry as well as successful requests.
- Describe website hosting, accounts/licensing, payments, and optional diagnostics separately from access to local files. Avoid a blanket claim that the business collects no data.

## Verification still to do

Use synthetic fixtures with fake identifying information. Do not put real personal/client data, secrets, or unsanitised network captures into the repository or test reports.

- [ ] Record actual network destinations during a cold-cache first run: app load, model and OCR downloads, folder selection, image/PDF analysis, comparison, and Apply. Check that file bytes, names/paths, extracted text, metadata, and embeddings do not appear in outgoing requests.
- [ ] After loading the app and caching all processing resources, disable the network and scan a previously unseen fixture folder. Include images, image text, and PDFs. Record what works and any remaining network dependencies. Repeat from a fresh app launch for the eventual installed build.
- [ ] Inspect Cache API, IndexedDB, local/session storage, worker storage, and any app-owned files after a scan, reload, folder switch, and clearing data. Document what remains and how to remove it.
- [ ] Review errors, diagnostics, and any support-export feature for accidental disclosure of filenames or file content.
- [ ] Record exact shipped model/library versions, model revision or checksum, licences, and required notices. Review the converted model assets as well as their upstream model.
- [ ] Inventory production hosting, account/licence, payment, and diagnostic services, including the data each receives and applicable retention settings.
- [ ] Review legal obligations for the intended launch markets, customer relationships, and actual data handling. Confirm any applicable notice, consent, deletion, security, or contractual requirements. Do not claim compliance with a named law or standard without an appropriate review.
- [ ] Reconcile landing-page, in-app, store-listing, and privacy-policy claims with the verified behaviour of that release.

## Candidate public wording

For the local core, after verification:

> Your files are analysed on your device. We don't upload their contents or use them to train AI models.

Explain model/resource downloads and any local caching in the supporting privacy notice. The current source review alone does not verify a universal offline or zero-network promise. A future optional cloud feature would require more specific wording.

## When to revisit

- Review monthly while the product is actively being developed, and before every public release.
- Also review whenever changing models/dependencies, network requests, caching/saved progress, diagnostics, accounts/payments, desktop permissions, folder watching, or cloud features.
- Update the relevant evidence and review log when a check is actually performed. Leave unfinished checks open.
- Record a substantial new privacy test in `TESTING.md`; log any discovered break and fix in `build-log.md`. Use sanitised summaries.
- This is a project review cadence. No scheduled reminder or background monitoring has been created.

| Date | Review | Result / next step |
| --- | --- | --- |
| 2026-11-02 | App source, selected dependency defaults, and primary documentation reviewed; initial product discussion recorded. | Local processing direction supported by source. Network, storage, distribution-licence, and legal-scope checks remain open. Next routine review: 2026-12-02, or sooner at a trigger above. |
| 2026-11-02 | Added local Instrument Sans and EB Garamond assets and reviewed font-loading source. | Both families include their OFL notices. Four font faces loaded in a temporary Chrome specimen page; no font CDN integration was added. Broader network checks remain open. |
| 2026-11-02 | Added intro folder drag-and-drop and reviewed its access path. | Reuses existing local scan/analysis; no upload, persistence, write-permission request, or new processing provider was added. Native folder picker opened in Chrome. Browser tests used synthetic handles/events; native Finder drag remains unverified. |

## References

Reviewed on 2026-11-02; recheck terms when choosing or updating a dependency/provider.

- [Transformers.js: running pretrained models in the browser](https://huggingface.co/docs/transformers.js/index)
- [Transformers.js: hosted defaults and local model/resource configuration](https://huggingface.co/docs/transformers.js/custom_usage)
- [Model conversion used by the app: ONNX Community DINOv2 small](https://huggingface.co/onnx-community/dinov2-small)
- [Upstream DINOv2 small model information](https://huggingface.co/facebook/dinov2-small) and [upstream licence](https://github.com/facebookresearch/dinov2/blob/main/LICENSE)
- [Model conversion used for media-type matching: Xenova all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) and [upstream model](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- [Tesseract.js project and documentation](https://github.com/naptha/tesseract.js)
- [FTC guidance: privacy by design and truthful app claims](https://www.ftc.gov/business-guidance/resources/marketing-your-mobile-app-get-it-right-start)

The FTC guidance is a starting reference, not an exhaustive account of the laws applicable to this product.
