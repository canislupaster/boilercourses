import * as cheerio from "cheerio";
import {Cheerio} from "cheerio";
import {readFile} from "node:fs/promises";
import {ProxyAgent} from "undici";
import cliProgress from "cli-progress";
import { Element } from "domhandler";

const userAgent = "boilercourses scraper";

type Dispatcher = ({
	type: "proxy", proxy: ProxyAgent
}|{
	type: "main"
})&{errorWait?: number, name: string};

const dispatchers: Dispatcher[] = [{type: "main", name: "main"}];
const waiters: (()=>void)[] = [];

export function shuffle<T>(arr: T[]) {
	for (let i=1; i<arr.length; i++) {
		const j = Math.floor(Math.random()*(i+1));
		const x = arr[j];
		arr[j]=arr[i];
		arr[i]=x;
	}
}

export async function addProxies(proxiesPath: string) {
	dispatchers.splice(0,dispatchers.length);

	let prox = JSON.parse(await readFile(proxiesPath, "utf-8")) as string[]|{proxyFetchUrl: string};
	if ("proxyFetchUrl" in prox) {
		console.log("fetching proxies...");
		prox = (await (await fetch(prox.proxyFetchUrl)).text()).trim().split("\n");
	}

	console.log(`adding ${prox.length} proxies`);

	let pi=1;
	for (const p of prox) {
		const parts = p.split(":");
		if (parts.length!=2 && parts.length!=4)
			throw new Error(`expected 2 (host,port) or 4 parts (host,port,user,pass) for proxy ${p}`);

		const proxy = new ProxyAgent({
			uri: `http://${parts[0]}:${parts[1]}`,
			token: parts.length==2 ? undefined : `Basic ${Buffer.from(`${parts[2]}:${parts[3]}`).toString('base64')}`
		});

		dispatchers.push({type: "proxy", proxy, name: `Proxy #${pi++} (${parts[0]}:${parts[1]})`});
	}
	shuffle(dispatchers);
}

const dispatcherWait = 1000, dispatcherErrorWait = 30_000
const dispatcherErrorWaitMul = 2, dispatcherTimeout = 120_000;
const maxDispatcherErrorWait = 60_000*5;

export async function fetchDispatcher<T>({ transform, handleErr }: {
	transform: (r: Response) => Promise<T>,
	handleErr?: (r: Response) => Promise<"retry"|T>
}, ...args: Parameters<typeof fetch>): Promise<T> {
	let err: Error|null=null;
	for (let retryI=0; retryI<5; retryI++) {
		while (dispatchers.length==0) {
			await new Promise<void>((res) => waiters.push(res));
		}

		const d = dispatchers.pop()!;
		err=null;

		try {
			const hdrs = new Headers({...args[1]?.headers});
			hdrs.append("User-Agent", userAgent);

			const resp = await fetch(args[0], {
				...args[1],
				//@ts-ignore
				dispatcher: d.type=="proxy" ? d.proxy : undefined,
				headers: hdrs,
				signal: AbortSignal.timeout(dispatcherTimeout)
			});

			if (resp.status!=200) {
				if (handleErr) {
					const r = await handleErr(resp);
					if (r!="retry") return r;
				}

				throw new Error(resp.statusText);
			}
			return await transform(resp)
		} catch (e) {
			if (e instanceof Error) err=e;
		} finally {
			if (err) {
				d.errorWait = d.errorWait==undefined ? dispatcherErrorWait
					: Math.min(d.errorWait*dispatcherErrorWaitMul, maxDispatcherErrorWait);
				//progress bar sometimes makes it hard to read (thus newlines)
				console.warn(`\nError with dispatcher ${d.name}, waiting ${(d.errorWait/60/1000).toFixed(2)} min.\n`);
			} else {
				delete d.errorWait;
			}

			setTimeout(() => {
				dispatchers.unshift(d);
				const w = waiters.shift();
				if (w!==undefined) w();
			}, d.errorWait ?? dispatcherWait);
		}
	}

	throw new Error(`ran out of retries during fetch:\n${err!}`);
}

//purdue catalog specific
async function loadAndCheckRatelimit(x: Response): Promise<cheerio.CheerioAPI> {
	const c = cheerio.load(await x.text());
	if (c("body").text().trim()=="We are sorry, but the site has received too many requests. Please try again later.")
		throw new Error("ratelimited");
	return c;
}

export async function getHTML(url: string, qparams: Record<string,string>={}) {
	const u = new URL(url);
	for (const [k,v] of Object.entries(qparams))
		u.searchParams.append(k,v);
	return await fetchDispatcher({transform: loadAndCheckRatelimit}, u);
}

export async function postHTML(url: string, form: [string,string][]=[]) {
	const d = new URLSearchParams();
	for (const [k,v] of form) d.append(k,v);
	return await fetchDispatcher({transform: loadAndCheckRatelimit}, url, {
		body: d, method: "POST",
		headers:{
      'Content-Type': 'application/x-www-form-urlencoded'
    }
	});
}

declare global { 
	interface String {
		trimStartsWith(v: string): string|null;
		trimIfStarts(v: string): string;
	}
}

String.prototype.trimStartsWith = function(v: string) {
	if (this.startsWith(v)) return this.slice(v.length);
	else return null;
}

String.prototype.trimIfStarts = function(v: string) {
	if (this.startsWith(v)) return this.slice(v.length);
	else return this as string;
}

export function tableToObject(c: cheerio.CheerioAPI, tb: Cheerio<Element>) {
	tb = tb.children();
	const hdr = tb.first().children().toArray().map(e => c(e).text().trim());
	const rest = tb.slice(1).toArray()
		.map(e => c(e).children().toArray().map(f => c(f).text().trim()));
	return rest.map((row) => Object.fromEntries(hdr.map((h,i) => [h,row[i]])));
}

export const ords = ["first","second","third","fourth","fifth","sixth","seventh","eighth","ninth","tenth"];

export function logArray<T, R>(x: T[], y: (x:T) => Promise<R>, name: (x:T,i:number)=>string): Promise<PromiseSettledResult<Awaited<R>>[]> {
	console.log(`beginning operation on ${x.length} objects`);

	const bar = new cliProgress.SingleBar({
		format: "[{bar}] {percentage}% | ETA: {eta}s | {value}/{total} | finished {last}"
	}, cliProgress.Presets.shades_classic);
	bar.start(x.length, 0);

	return Promise.allSettled(x.map((p,i) => y(p).finally(() => {
		bar.increment(1,{ last: name(p,i) });
	}).catch((reason) => {
		console.error(`object ${name(p,i)} failed: ${reason}`);
		throw reason;
	}))).then((x) => {
		console.log("\ndone");
		return x;
	}).finally(() => {
		bar.stop();
	});
}

//like isdeepstrictequals but epsilon for floating point
//also treats undefined as not a property
export function deepEquals(x: unknown, y: unknown) {
	switch (typeof x) {
		case "undefined": return true;
		case "bigint":
		case "string":
		case "boolean":
			return x==y;

		case "object": {
			if (typeof y != "object") return false;
			if (x==null || y==null) return x==y;

			for (const k in y)
				if (y[k as keyof typeof y]!==undefined && x[k as keyof typeof x]===undefined)
					return false;

			for (const k in x) {
				if (x[k as keyof typeof x]===undefined) continue;
				else if (y[k as keyof typeof y]===undefined) return false;
				else if (!deepEquals(x[k as keyof typeof y], y[k as keyof typeof y])) return false;
			}

			return true;
		}
			
		case "number":
			if (typeof y != "number") return false;
			// i think all numbers in data should be bounded so this should work
			return Math.abs(x-y)<1e-4;

		case "symbol":
		case "function":
			throw new Error("cannot deep compare symbols/functions")
	}
}