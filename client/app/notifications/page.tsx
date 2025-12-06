"use client"

import { Notifications } from "@/components/availability";
import { LogoBar } from "@/components/logo";
import { Loading, Text } from "@/components/util";
import { AppCtx, useSignInRedirect } from "@/components/wrapper";
import { useRouter } from "next/navigation";
import { useContext, useEffect } from "react";

export default function NotificationPage() {
	const router = useRouter();
	const redir = useSignInRedirect();
	const {hasAuth} = useContext(AppCtx);
	useEffect(()=>{
		if (hasAuth==false) redir(undefined, "/");
	}, [hasAuth, redir]);

	if (!hasAuth) return <Loading/>;
	return <div className="flex flex-col gap-2 max-w-(--breakpoint-sm) w-full self-center">
		<LogoBar onClick={()=>{
			router.push("/");
		}} />

		<Text v="big" >Manage notifications</Text>
		<Notifications/>
	</div>;
}