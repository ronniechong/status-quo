import { Dialog, Portal } from "@ark-ui/react";
import { useEffect, useRef } from "react";
import * as s from "./HowThisWorks.css";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	triggerRef: React.RefObject<HTMLElement | null>;
	defaultModel: string;
	defaultPromptVersion: string;
	providerCount: number;
}

export default function HowThisWorks({ open, onOpenChange, triggerRef, defaultModel, defaultPromptVersion, providerCount }: Props) {
	const closeRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (!open) return;
		const id = setTimeout(() => closeRef.current?.focus(), 50);
		return () => {
			clearTimeout(id);
			triggerRef.current?.focus();
		};
	}, [open, triggerRef]);
	return (
		<Dialog.Root
			open={open}
			onOpenChange={(d) => onOpenChange(d.open)}
			initialFocusEl={() => closeRef.current}
			finalFocusEl={() => triggerRef.current}
		>
			<Portal>
			<Dialog.Backdrop className={s.backdrop} />
			<Dialog.Positioner className={s.positioner}>
				<Dialog.Content className={s.content}>
					<div className={s.header}>
						<Dialog.Title className={s.title}>How this works</Dialog.Title>
						<Dialog.CloseTrigger ref={closeRef} aria-label="Close" className={s.close}>
							<span aria-hidden="true">✕</span>
						</Dialog.CloseTrigger>
					</div>

					<p className={s.body}>
						Status Quo collects incident reports published by SaaS providers and uses a language model to summarise them
						into a common shape. Every number on this site is computed from collected data — nothing is invented.
					</p>

					<div className={s.section}>
						<div className={s.heading}>Collection</div>
						<p className={s.body}>
							{providerCount} providers, polled roughly every 12 hours. Collection depth varies by provider because each
							one caps how much of its own incident history it exposes — nothing is backfilled beyond what a provider's
							API returns. A newly-added provider starts collecting from the day it's added, not retroactively.
						</p>
					</div>

					<div className={s.section}>
						<div className={s.heading}>What the model does</div>
						<p className={s.body}>
							Tags each incident by affected surface from a fixed set of categories, and summarises its update
							sequence into a title and short summary. Model: <code>{defaultModel}</code>, prompt{" "}
							<code>{defaultPromptVersion}</code>.
						</p>
					</div>

					<div className={s.section}>
						<div className={s.neverBox}>
							<div className={s.heading}>What it never does</div>
							<ul className={s.neverList}>
								<li>Produce a number — every figure on this page comes from a query over collected data.</li>
								<li>Rate severity — the severity shown is the provider's own, never a model judgement.</li>
								<li>Infer a cause the provider didn't state.</li>
							</ul>
						</div>
					</div>

					<div className={s.section}>
						<div className={s.heading}>Accuracy</div>
						<p className={s.body}>
							A 50-incident hand-labelled sample was scored against an over-claiming rubric (asserting a cause only
							implied, upgrading uncertainty to certainty, inflating scope). Measured result: <strong>0% combined
							over-claiming rate</strong> (gate: ≤10%), <strong>zero Fabrication</strong> findings.
						</p>
						<p className={s.admission}>
							The reviewer for this measurement was this site's author, not an independent party — treat the number
							accordingly.
						</p>
					</div>

					<div className={s.section}>
						<div className={s.heading}>Versioning</div>
						<p className={s.body}>
							Prompts are versioned. Older incidents keep their original interpretation until reprocessed — this is why
							a provenance badge appears on some cards instead of every card.
						</p>
					</div>

					<div className={s.section}>
						<div className={s.heading}>Corrections</div>
						<p className={s.body}>
							"Report an error" on any card opens a GitHub issue. Corrections are stored alongside the model's original
							output, never replacing it, so the error rate stays measurable over time.
						</p>
					</div>

					<div className={s.footer}>
						<a href="https://github.com/ronniechong/status-quo" className={s.link}>
							Source code
						</a>
						{" · "}
						Not affiliated with any provider shown.
					</div>
				</Dialog.Content>
			</Dialog.Positioner>
			</Portal>
		</Dialog.Root>
	);
}
