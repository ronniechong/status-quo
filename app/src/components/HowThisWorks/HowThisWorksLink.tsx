import { useHashRoute } from "../../lib/useHashRoute";
import HowThisWorks from "./HowThisWorks";

interface Props {
	defaultModel: string;
	defaultPromptVersion: string;
}

export default function HowThisWorksLink({ defaultModel, defaultPromptVersion }: Props) {
	const { hash, navigate, close } = useHashRoute();
	const open = hash === "#/how-this-works";

	return (
		<>
			<a
				href="#/how-this-works"
				onClick={(e) => {
					e.preventDefault();
					navigate("#/how-this-works");
				}}
			>
				How this works
			</a>
			<HowThisWorks
				open={open}
				onOpenChange={(next) => (next ? navigate("#/how-this-works") : close())}
				defaultModel={defaultModel}
				defaultPromptVersion={defaultPromptVersion}
			/>
		</>
	);
}
