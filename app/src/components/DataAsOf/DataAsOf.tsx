import { useEffect, useState } from "react";
import { IntlProvider, useIntl } from "react-intl";
import { useLocale } from "../../lib/useLocale";
import { formatUtcDateTime } from "../../lib/incidents";
import { fetchMeta } from "../../lib/dataSource";

function DataAsOfInner({ iso }: { iso: string }) {
	const intl = useIntl();
	return <strong>{formatUtcDateTime(intl, iso)}</strong>;
}

export default function DataAsOf() {
	const locale = useLocale();
	const [iso, setIso] = useState<string | null>(null);

	useEffect(() => {
		fetchMeta()
			.then((meta) => setIso(meta.generated_at_utc))
			.catch(() => setIso(null));
	}, []);

	if (!iso) return <strong>—</strong>;

	return (
		<IntlProvider locale={locale} defaultLocale="en-US">
			<DataAsOfInner iso={iso} />
		</IntlProvider>
	);
}
