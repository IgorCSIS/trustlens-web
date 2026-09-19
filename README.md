<p align="center">
  <img src=".github/assets/hero.svg" alt="TrustLens: raw scanners cry wolf. TrustLens reads the code." width="880" />
</p>

<p align="center">
  <img alt="Base mainnet" src="https://img.shields.io/badge/network-Base_mainnet-0052FF?style=flat-square&labelColor=3E2230" />
  <img alt="Free beta" src="https://img.shields.io/badge/status-free_beta-FFD23F?style=flat-square&labelColor=3E2230" />
  <img alt="Reads real code" src="https://img.shields.io/badge/AI-reads_real_code-FF4B5C?style=flat-square&labelColor=3E2230" />
  <img alt="Follow @SafuLens" src="https://img.shields.io/badge/follow-@SafuLens-3E2230?style=flat-square&labelColor=3E2230&logo=x" />
</p>

<p align="center">
  <a href="https://trustlens-web.niftyai.workers.dev"><strong>Try it live →</strong></a>
</p>

---

# TrustLens: proxy-aware contract safety scanning on Base

> **Know before you ape.** TrustLens reads a contract's real code and tells you what's safe, what's not, and how to fix it.

## What it does

Paste any contract address on Base. TrustLens pulls the verified source, runs a full static analysis, then puts an AI security reviewer on top of the raw output to tell you which flags are real and which are noise.

Here is the part that matters.

Point a raw scanner at Circle's USDC and the flags light up like a fire alarm: **DANGEROUS, 71 out of 100.** Blocklists, upgradeable proxies, privileged roles, the works. Technically present. Completely misread.

TrustLens follows the proxy to the real FiatToken implementation and reads that code, then tells you the truth: **CAUTION, 25 out of 100. This is canonical USDC.** Battle-tested, the privileged functions are Circle's and are expected, and the one thing worth knowing is that its admin is a single key that can upgrade the logic. Now you know exactly what you are trusting.

That gap between "flag exists" and "flag matters" is where people get scared out of good contracts and lured into bad ones. TrustLens lives in that gap.

## Why it's different

Raw scanners pattern-match. They see `delegatecall`, they see an owner role, they see a mint function, and they scream. Every flag looks like a five-alarm fire, so every flag gets ignored. Alert fatigue is a security hole.

TrustLens reads the code the way a security researcher would:

- **Triage, not noise.** Every flag gets labeled REAL or false positive, with the reasoning.
- **Context beats keywords.** A mint function on a rug is a threat. A mint function on USDC is Tuesday. TrustLens knows the difference.
- **Proof for the real ones.** When a flag is genuine, you get a concrete example of how it gets exploited, plus a fix you can paste in.

You stop drowning in red. You start seeing what is actually dangerous.

## How it works

1. **Paste an address.** Any verified contract on Base mainnet.
2. **Get the raw scan, free and instant.** Every flag a static analyzer would raise, no signup.
3. **Open the AI deep report, free in beta.** Plain-English triage: what's real, what's noise, and for the real issues, how it gets attacked and how to fix it.

## Try it live

**[trustlens-web.niftyai.workers.dev](https://trustlens-web.niftyai.workers.dev)**

No wallet connection required to scan. No signup to read the report. Free while we are in beta.

Start with USDC if you want to watch raw flags scream DANGEROUS on the real implementation and then get taken apart line by line.

## For developers

Shipping a contract? TrustLens is a second set of eyes that never gets tired.

For every real issue it finds, you get two things a plain scanner will not give you:

- **A concrete attack example.** Not "reentrancy risk detected." An actual walkthrough of how the funds leave, in the specific shape of your code.
- **A copy-paste fix.** The corrected pattern, ready to drop into your contract.

Triage plus a fix, in the time it takes to read one Slither report by hand.

## Tech stack

| Layer | Built with |
|-------|-----------|
| Frontend | React, Vite, wagmi, viem |
| Backend | FastAPI, Slither, web3.py |
| AI triage | Claude |
| On-chain | Solidity `PaymentGate` on Base |

Static analysis does the detection. The AI layer does the judgment. The frontend keeps it fast and readable.

## Open source

TrustLens is four repos, the first tool in the [SafuLens](https://x.com/SafuLens) suite:

<p align="center">
  <img src=".github/assets/repos.svg" alt="The four TrustLens repositories. trustlens-web posts scan and report requests to trustlens-backend, which reads Base and an AI triage API. trustlens-keepwarm requests the backend health endpoint every ten minutes. trustlens-contracts holds PaymentGate on Base Sepolia, and both payment arrows are dashed because they are switched off while the scanner is in free beta." width="880">
</p>


- **[Frontend](https://github.com/IgorCSIS/trustlens-web)** (this repo): React + wagmi/viem
- **[Backend](https://github.com/IgorCSIS/trustlens-backend)**: FastAPI, Slither, web3, the proxy resolver and the AI triage layer
- **[Contracts](https://github.com/IgorCSIS/trustlens-contracts)**: Foundry `PaymentGate`, dark during the free beta
- **[Keepwarm](https://github.com/IgorCSIS/trustlens-keepwarm)**: a cron that pings the backend so Render's free tier never cold-starts

## Roadmap

Free beta today.

Built and deployed, waiting on a switch:

- **Pay-per-scan.** One deep report, one address, no subscription.
- **Unlimited.** A monthly pass, for traders and devs who scan all day.

Both live in `PaymentGate` on Base Sepolia, and the backend already knows how
to verify a payment against it. Turning them on is a config change, not a
build. Prices are not fixed yet, so the numbers here are deliberately absent
rather than invented.

Not built yet:

- **Founders Pass.** A lifetime NFT for the people who showed up early. There
  is no contract for it, which is why the app marks it SOON rather than
  taking anybody's money.

## License

[MIT](LICENSE)

---

<sub>TrustLens reads contracts, not tea leaves. Built by <a href="https://x.com/SafuLens">@SafuLens</a>. Free beta. Not financial advice.</sub>
