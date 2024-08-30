"use client"

import { useRouter } from "next/navigation";
import { ServerResponse } from "../../../shared/types";

import { MsalProvider, useMsal } from "@azure/msal-react";
import { AppCtx, setAuth, useAPI } from "@/components/wrapper";
import { useContext, useEffect, useState } from "react";
import { Button, Loading } from "@/components/util";
import { Alert, BackButton, msalApplication, msalClientId } from "@/components/clientutil";

import icon from "../../public/icon.png";
import Image from "next/image";
import { BrowserAuthError, BrowserAuthErrorCodes } from "@azure/msal-browser";
import { Footer } from "@/components/footer";

type AuthErr = ServerResponse<unknown>&{status: "error", error: "unauthorized"|"sessionExpire"};

export function redirectToSignIn() {
	const router = useRouter();
	const app = useContext(AppCtx);
	return (err?: AuthErr) => {
		app.forward();
		window.localStorage.setItem("signIn", JSON.stringify({err, redirect: window.location.href}));
		router.push("/signin");
	};
}

function SignedIn({loggedIn,tok}: {loggedIn: ()=>void,tok:string}) {
	const ret = useAPI<{id: string, key: string}, string>("login", {data: tok})

	useEffect(() => {
		if (ret!=null) {
			setAuth(ret.res);
			loggedIn();
		}
	}, [ret]);

	return <>
		<h1 className="text-xl font-display" >Signing in...</h1>
		<Loading/>
	</>;
}

function SignInMSAL({loggedIn, err}: {loggedIn: ()=>void, err?: AuthErr}) {
	const msal = useMsal();

	const [tok, setTok] = useState<null|string>(null);
	const app = useContext(AppCtx);

	if (tok!=null)
		return <SignedIn tok={tok} loggedIn={loggedIn} />;

	return <>
		{err && <Alert bad className="mb-4 w-full max-w-96"
			title={err.error=="sessionExpire" ? "Your session expired" : "That's off-limits for your account"}
			txt={err.error=="sessionExpire" ? "You must sign in again" : "Try logging in with another account"} />}

		<div className="flex flex-col gap-2 max-w-96 border-zinc-700 border-1 p-5 px-10 rounded-lg" >
			<BackButton noOffset />

			<div className="flex flex-col w-full items-center" >
				<Image src={icon} alt="logo" className='max-h-36 w-auto' />
			</div>

			<h2 className="text-3xl font-display font-black" >Sign in to continue</h2>
			<p>Be sure to use your <b>@purdue.edu Microsoft account</b>!</p>

			<Button className="w-full" onClick={() => {
				msal.instance.acquireTokenPopup({
					scopes: [`${msalClientId}/.default`],
					account: msal.accounts[0]
					//using a nonce would be cool but i think its fine, def more secure than password...
				})
					.then((tok)=>setTok(tok.idToken))
					.catch((e)=>{
						let msg = `${e}`;
						if (e instanceof BrowserAuthError) {
							if (e.errorCode==BrowserAuthErrorCodes.userCancelled)
								return;

							msg=e.message;
						}

						app.open({type:"error", name: "Failed to sign in", msg})
					});
			}} >Sign in</Button>
		</div>
	</>;
}

export function SignIn() {
	const [v,setV] = useState<{err?: AuthErr, redirect: string}|null>(null);

	const router = useRouter();
	useEffect(() => {
		const it = window.localStorage.getItem("signIn");

		if (it==null) router.push("/")
		else setV(JSON.parse(it));
	}, [])

	if (v==null) return <Loading/>;

	return <div className="w-full h-full flex flex-col py-16 items-center" >
		<MsalProvider instance={msalApplication} >
			<SignInMSAL loggedIn={()=>router.push(v.redirect)} err={v.err} />
		</MsalProvider>
		<Footer/>
	</div>;
}