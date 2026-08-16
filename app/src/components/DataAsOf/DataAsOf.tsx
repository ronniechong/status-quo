import { IntlProvider, useIntl } from "react-intl";
import { useLocale } from "../../lib/useLocale";
import { formatUtcDateTime } from "../../lib/incidents";

interface Props {
	iso: string;
}

function DataAsOfInner({ iso }: Props) {
	const intl = useIntl();
	return <strong>{formatUtcDateTime(intl, iso)}</strong>;
}

export default function DataAsOf({ iso }: Props) {
	const locale = useLocale();
	return (
		<IntlProvider locale={locale} defaultLocale="en-US">
			<DataAsOfInner iso={iso} />
		</IntlProvider>
	);
}
