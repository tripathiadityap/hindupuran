# Purāṇa Viśva

A modern, minimal, monochrome way to read and explore all **eighteen Mahāpurāṇas**, with a deep dive into the **Garuḍa Purāṇa**.

- **Library**: all 18 Purāṇas with their structure, narrator, deities, themes, stories and a lesson from each
- **Garuḍa**: the two khaṇḍas, the soul's journey in the Preta Khaṇḍa, the narakas, and common questions
- **Explore**: a force-directed knowledge graph styled like a machine-vision tracker
- **Concepts**: the five marks of a Purāṇa, the yugas and cosmic time, the avatāras, the guṇa classification
- **Reflect**: a private journal that suggests related stories (stored only in your browser)
- **Read**: full Sanskrit for 14 Purāṇas (≈1,29,000 verses, from GRETIL, shown in Devanagari or IAST) and complete public-domain English translations of the Viṣṇu, Garuḍa, Mārkaṇḍeya, Matsya and Agni Purāṇas (from archive.org scans, OCR). Your reading place is remembered.
- **Ask**: write a question or a feeling; passages are ranked by cosine similarity using all-MiniLM-L6-v2 embeddings (index built offline, query embedded in your browser). It falls back to keyword search while the model loads.
- **Search**: press ⌘K / Ctrl K or /
- **Ambient rāga**: a tanpura drone, flute and temple bells, synthesised live with the Web Audio API. No recordings are used, so there is nothing under copyright. The rāga changes with the page (Bhūpālī, Yaman, Bhairavī, Mālkauns).

Static site with no build step. Run it locally with `python3 -m http.server`, or deploy the folder as-is to Vercel.

## Texts and licences

- Sanskrit: [GRETIL](https://gretil.sub.uni-goettingen.de/), CC BY-NC-SA 4.0. Used here non-commercially with attribution.
- English: public-domain translations (1895–1917) from archive.org: H. H. Wilson's Viṣṇu (1895 prose edition), M. N. Dutt's Garuḍa (1908) and Agni (1903–04), F. E. Pargiter's Mārkaṇḍeya (1904), and the Matsya (Sacred Books of the Hindus, 1916–17). The text is machine-read (OCR), so misprints remain.
- Padma, Varāha, Bhaviṣya and Brahmavaivarta have no openly licensed full text yet.

## Rebuilding the data

`tools/` holds the pipeline: `build_sa.py` (GRETIL TEI to `data/sa/*.json`), `build_en.py` and `en_parse.py` (archive.org OCR to `data/en/*.json` plus passages), and `embed.mjs` (passages to `data/search/vectors.bin` with `@huggingface/transformers` 3.7.6 and `Xenova/all-MiniLM-L6-v2`, q8).
