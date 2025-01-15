"use client"

import { Alert } from "@/components/clientutil";
import { Button, Loading, StatusPage, Text } from "@/components/util";
import { AppCtx, useAPIResponse } from "@/components/wrapper";
import { use, useContext } from "react";

export default function Verify({searchParams: searchParamsAsync}: {searchParams: Promise<object>}) {
	const searchParams = use(searchParamsAsync);
	const bad = !("key" in searchParams) || !("email" in searchParams)
			|| typeof searchParams.key!="string" || typeof searchParams.email!="string";

	const verify = useAPIResponse<void, {email: string, key: string}>("notifications/verify", {
		data: bad ? undefined : {email: searchParams.email as string, key: searchParams.key as string},
		disabled: bad
	});

	const app = useContext(AppCtx);

	if (bad)
		return <StatusPage title="We couldn't verify your email" >
			<Alert title="An error occurred" txt="The URL is incorrect or malformed. Try opening the link again." bad ></Alert>
		</StatusPage>;

	if (verify==null) return <Loading/>;
	return <StatusPage title="Verified" >
		<Text v="bold" >Your email has been verified and you{"'"}re set to receive notifications!</Text>
		<Button onClick={()=>{
			app.goto("/notifications");
		}} >Manage your notifications</Button>
	</StatusPage>;
}