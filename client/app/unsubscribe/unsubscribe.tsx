"use client"

import { bgColor, Button, StatusPage, Text } from "@/components/util";
import { useAPI } from "@/components/wrapper";
import { useState } from "react";

export const Unsubscribed = () => <StatusPage title="Unsubscribed" >
	<p>You have been successfully unsubscribed from all email notifications and cannot register to receive any more. If you wish to undo this, please contact me.</p>
</StatusPage>;

type Unsubscribe = {email: string, key: string};

export function Unsubscribe({req}: {req: Unsubscribe}) {
	const unsub = useAPI<void, Unsubscribe>("notifications/unsubscribe");
	const [done, setDone] = useState(false);

	if (done) return <Unsubscribed/>;

	return <StatusPage title="Are you sure?" >
		<Text v="bold" >Click the button below to permanently unsubscribe from all future emails from BoilerCourses</Text>
		<Button className={bgColor.red} onClick={()=>{
			unsub.run({data: req, refresh() {
				setDone(true);
			}})
		}} >Unsubscribe</Button>
	</StatusPage>;
}