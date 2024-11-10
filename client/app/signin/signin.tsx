"use client"

import { useRouter } from "next/navigation";

import { Alert, BackButton } from "@/components/clientutil";
import { borderColor, Button, Loading, Text } from "@/components/util";
import { AppCtx, AuthErr, setAuth, useAPI } from "@/components/wrapper";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { useContext, useEffect, useState } from "react";

import { Footer } from "@/components/footer";
import { Logo } from "@/components/logo";
import { BrowserAuthError, BrowserAuthErrorCodes, PublicClientApplication } from "@azure/msal-browser";

export const msalClientId = process.env.NEXT_PUBLIC_MSAL_CLIENT_ID;
export const msalApplication = new PublicClientApplication({
	auth: {
		clientId: msalClientId!,
		authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_MSAL_TENANT!}`,
		redirectUri: `${process.env.NEXT_PUBLIC_ROOT_URL}/signin`
	}
});

function SignedIn({loggedIn,tok}: {loggedIn: ()=>void,tok:string}) {
	const ret = useAPI<{id: string, key: string}, string>("login", {data: tok})
	const app = useContext(AppCtx);

	useEffect(() => {
		if (ret!=null) {
			setAuth(ret.res);
			app.setHasAuth(true);
			loggedIn();
		}
	}, [ret]);

	return <>
		<Text v="lg" >Signing in...</Text>
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

		<div className={`flex flex-col gap-2 max-w-96 border-1 p-5 px-10 rounded-lg ${borderColor.default}`} >
			<BackButton noOffset />

			<div className="flex flex-col w-full items-center" >
				<Logo className='max-h-36 w-auto' />
			</div>

			<Text v="big" >Sign in to continue</Text>
			<Text>Be sure to use your <b>@purdue.edu Microsoft account</b>!</Text>

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
		else setV(JSON.parse(it) as typeof v);
	}, [])

	if (v==null) return <Loading/>;

	return <div className="w-full h-full flex flex-col py-16 items-center" >
		<MsalProvider instance={msalApplication} >
			<SignInMSAL loggedIn={()=>router.push(v.redirect)} err={v.err} />
		</MsalProvider>
		<Footer/>
	</div>;
}