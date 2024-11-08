import { Alert } from "@/components/clientutil";
import { StatusPage } from "@/components/util";
import { api, catchAPIError } from "../server";
import { headers } from "next/headers";
import { Unsubscribe, Unsubscribed } from "./unsubscribe";

export default catchAPIError(async ({searchParams: searchParamsAsync}: {searchParams: Promise<object>}) => {
	const requiresConfirmation = (await headers()).get("x-method")!="POST";
	const searchParams = await searchParamsAsync;
	if (!("key" in searchParams) || !("email" in searchParams)
			|| typeof searchParams.key!="string" || typeof searchParams.email!="string")
		return <StatusPage title="We couldn't unsubscribe you" >
			<Alert title="An error occurred" txt="The URL is incorrect or malformed." bad ></Alert>
		</StatusPage>;

	const req = {key:searchParams.key, email:searchParams.email};
	if (requiresConfirmation)
		return <Unsubscribe req={req} />;

	await api("notifications/unsubscribe", req);
	return <Unsubscribed/>;
});