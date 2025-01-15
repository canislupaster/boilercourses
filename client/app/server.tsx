/* eslint-disable react/no-unknown-property */
//utilities for server...
//you shouldn't use any of these from non-server components

import { StatusPage, Text } from "@/components/util";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { CourseId, errorName, InstructorId, ServerInfo, ServerResponse } from "../../shared/types";

class APIError extends Error {
	constructor(public res: ServerResponse<unknown>&{status: "error"}) {
		super(`couldn't fetch: ${res.error} - ${res.message}`);
	}
};

//a much worse api wrapper for server
export async function api<T,>(endpoint: string, data?: unknown): Promise<T> {
	const v = (await headers()).get("X-Forwarded-For");
	const fetchHdr = new Headers();
	if (v!=null)
		fetchHdr.append("X-Forwarded-For", v.slice(v.lastIndexOf(",")+1));

	const res = await (await fetch(`${process.env.SERVER_URL}/${endpoint}`, {
		method: "POST",
		headers: fetchHdr,
		body: data == undefined ? undefined : JSON.stringify(data),
		cache: "no-cache" //its literally right here
	})).json() as ServerResponse<T>;

	if (res.status == "error") {
		if (res.error == "notFound") notFound();
		throw new APIError(res);
	}

	return res.result;
}

export function catchAPIError<T,A extends unknown[]>(f: (...args: A)=>Promise<T>): (...args: A) => Promise<T|ReturnType<typeof StatusPage>> {
	return async (...args) => {
		try {
			return await f(...args);
		} catch (e) {
			if (e instanceof APIError) return <StatusPage title="An error occurred" >
				<Text v="md" >{errorName(e.res.error)}</Text>
				<Text>{e.res.message ?? "We encountered an error while trying to reach the API"}</Text>
			</StatusPage>
			else throw e;
		}
	};
}

export const courseById = (id: number): Promise<CourseId> => api("course", id)
export const profById = (id: number): Promise<InstructorId> => api("prof", id)

export const getInfo = (): Promise<ServerInfo> => api("info")

export async function makeThumbnail(title: string, sub: string) {
	const interSemiBold = await fetch(new URL('../public/Inter-SemiBold.ttf', import.meta.url))
		.then((res) => res.arrayBuffer());
	const interRegular = await fetch(new URL('../public/Inter-Regular.ttf', import.meta.url))
		.then((res) => res.arrayBuffer());
	const icon = await fetch(new URL('../public/icon-color.png', import.meta.url))
		.then((res) => res.arrayBuffer()).then(x => Buffer.from(x).toString("base64"));

	return new ImageResponse(
		(
			<div tw="w-full h-full flex flex-col justify-center items-center bg-stone-900" >
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src={`data:image/png;base64,${icon}`} alt="logo" height={200} width={200}/>
				<div tw="text-white flex flex-col px-16 pb-16 pt-8 items-center">
					<div tw="flex text-5xl w-full mb-4 items-center text-center" style={{ fontWeight: 500 }}>
						{title}
					</div>
					<div tw="flex text-2xl" style={{ fontWeight: 400 }}>
						{sub}
					</div>
				</div>
			</div>
		),
		{ 
			width: 1200, 
			height: 628, 
			fonts: [
				{
					name: 'Inter',
					data: interRegular,
					style: 'normal',
					weight: 400,
				},
				{
					name: 'Inter',
					data: interSemiBold,
					style: 'normal',
					weight: 500,
				},
			]
		}
	);
}