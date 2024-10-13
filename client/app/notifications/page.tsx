"use client"

import { Notifications } from "@/components/availability";
import { LogoBar } from "@/components/logo";
import { Loading, Text } from "@/components/util";
import { AppCtx, redirectToSignIn } from "@/components/wrapper";
import { useRouter } from "next/navigation";
import { useContext, useEffect } from "react";

export default function NotificationPage() {
	const router = useRouter();
	const redir = redirectToSignIn();
	const app = useContext(AppCtx);
	useEffect(()=>{if (app.hasAuth==false) redir(undefined, "/");}, [app.hasAuth]);

	if (!app.hasAuth) return <Loading/>;
	return <div className="flex flex-col gap-2 w-[min(35rem,100%)] self-center">
		<LogoBar onClick={()=>{
			router.push("/");
		}} />

		<Text v="big" >Manage notifications</Text>
		<Notifications/>
	</div>;
}