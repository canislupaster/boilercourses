import { Text, ThemeSpinner } from "@/components/util";

export default function LoadingApp() {
  return <div className="h-dvh flex items-center justify-center flex-col gap-3" >
		<ThemeSpinner size="lg" />
		<Text v="sm" >Hold on just a sec...</Text>
	</div>;
}