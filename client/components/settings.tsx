"use client"

import { IconMoonStars, IconSunFilled, IconUserCircle } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useContext, useEffect } from "react";
import { twMerge } from "tailwind-merge";
import { UserData } from "../../shared/posts";
import { Dropdown, DropdownPart } from "./clientutil";
import { IconButton, Loading, Text, textColor } from "./util";
import { AppCtx, callAPI, redirectToSignIn, setAuth } from "./wrapper";

function useLogout() {
	const app = useContext(AppCtx);
	const logout = callAPI("logout", true);

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

function UserEmail() {
	const u = callAPI<UserData|null>("user", "maybe");
	const app = useContext(AppCtx);
	const logout = useLogout();
	const email = u.loading ? null : {email: u.current?.res?.email};
	
	useEffect(()=>{
		if (app.hasAuth) u.run({
			refresh(x) {
				if (x.res==null) logout.logout();
			}
		});
	}, [app.hasAuth])

	return email==null ? <Loading/> : (email.email!=null ? <>Logged in with <b>{email.email}</b></> : "Not logged in");
}

export function UserButton() {
	const app = useContext(AppCtx);
	const logout = useLogout();
	const redir = redirectToSignIn();

	const deleteUser = callAPI("deleteuser", true);
	const router = useRouter();

	const drop: DropdownPart[] = [
		{type: "txt", txt: <p><UserEmail/></p>},
		{type: "act", name: app.hasAuth ? "Logout" : "Sign in",
			disabled: app.hasAuth==null || logout.loading, act() {

			if (app.hasAuth) logout.logout(); else redir();
		}},
	];

	if (app.hasAuth) drop.push({
		type: "act",
		name: "Notifications",
		act() {
			router.push("/notifications");
		}
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
