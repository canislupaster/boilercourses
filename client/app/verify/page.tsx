"use client"

import { Alert } from "@/components/clientutil";
import { Button, Loading, StatusPage, Text } from "@/components/util";
import { AppCtx, useAPI } from "@/components/wrapper";
import { use, useContext } from "react";

export default function Verify({searchParams: searchParamsAsync}: {searchParams: Promise<object>}) {
	const searchParams = use(searchParamsAsync);
	if (!("key" in searchParams) || !("email" in searchParams)
			|| typeof searchParams.key!="string" || typeof searchParams.email!="string")
		return <StatusPage title="We couldn't verify your email" >
			<Alert title="An error occurred" txt="The URL is incorrect or malformed. Try opening the link again." bad ></Alert>
		</StatusPage>;

	const verify = useAPI<void, {email: string, key: string}>("notifications/verify", {
		data: {email: searchParams.email, key: searchParams.key}
	});

	const app = useContext(AppCtx);

	if (verify==null) return <Loading/>;
	return <StatusPage title="Verified" >
		<Text v="bold" >Your email has been verified and you're set to receive notifications!</Text>
		<Button onClick={()=>{
			app.goto("/notifications");
		}} >Manage your notifications</Button>
	</StatusPage>;
}