"use client"

import { IconMoonStars, IconSunFilled, IconUserCircle } from "@tabler/icons-react";
import { useContext, useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import { UserData } from "../../shared/posts";
import { Dropdown, DropdownPart } from "./clientutil";
import { IconButton, Text, textColor } from "./util";
import { AppCtx, useAPI, useSignInRedirect, setAuth, useAPIResponse } from "./wrapper";

function useLogout() {
	const app = useContext(AppCtx);
	const logout = useAPI("logout", "unset");

	return {
		logout: () => logout.run({
			refresh() {
				setAuth(null);
				app.setHasAuth(false);
			}
		}),
		...logout
	}
}

function UserEmail({setAdmin}: {setAdmin: (x: boolean)=>void}) {
	// yeah so i should probably create a variant of useAPI for this case
	// instead of checking app.hasAuth to see if its loading....
	const u = useAPIResponse<UserData>("user", {auth: "unset"});

	useEffect(()=>{
		if (u) setAdmin(u.res.admin);
	}, [u, setAdmin]);

	const app = useContext(AppCtx);
	
	return app.hasAuth && u==null ? "..."
		: u!=null ? <>Logged in with <b>{u.res.email}</b></> : "Not logged in";
}

export function UserButton() {
	const app = useContext(AppCtx);
	const logout = useLogout();
	const redir = useSignInRedirect();

	const deleteUser = useAPI("deleteuser", "redirect");
	const [admin, setAdmin] = useState(false);

	const drop: DropdownPart[] = [
		{type: "txt", txt: <p><UserEmail setAdmin={setAdmin} /></p>},
		{type: "act", name: app.hasAuth ? "Logout" : "Sign in",
			disabled: app.hasAuth==null || logout.loading, act() {

			if (app.hasAuth) logout.logout(); else redir();
		}},
	];

	if (admin && app.hasAuth) drop.push({
		type: "act",
		name: "Admin panel",
		act() { app.goto("/admin"); }
	});

	if (app.hasAuth) drop.push({
		type: "act",
		name: "Notifications",
		act() { app.goto("/notifications"); }
	}, {
		type: "act",
		name: <Text className={textColor.red} >Delete all data</Text>,
		act() {
			app.open({
				type: "other", name: "Delete all your data?",
				modal: <p>
					This will remove all <b>posts/reviews and any other information across all courses</b> associated with your account and Purdue email, and log you out.
				</p>,
				actions: [
					{
						name: "Delete everything", status: "bad",
						act(c) {
							c.setLoading();
							deleteUser.run({
								refresh() {
									setAuth(null);
									app.setHasAuth(false);
									c.closeModal();
								}
							});

							return false;
						}
					}
				]
			});
		}
	});

	return <Dropdown trigger={<IconButton icon={<IconUserCircle size={18} />} />} parts={drop} />;
}

export function ThemeButton() {
	const app = useContext(AppCtx);
	return <IconButton icon={app.theme=="dark" ? <IconMoonStars size={18} /> : <IconSunFilled size={18}/>} onClick={()=>{
		app.setTheme(app.theme=="dark" ? "light" : "dark");
	}} />;
}

export const ButtonRow = ({className, children}: {className?: string, children?: React.ReactNode}) =>
	<div className={twMerge("flex flex-row items-center gap-1 mb-2", className)} >
		{children}
		<ThemeButton/>
		<UserButton/>
	</div>;
