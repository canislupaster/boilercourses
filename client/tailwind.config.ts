import { nextui } from "@nextui-org/theme"
import {Config} from "tailwindcss"

/** @type {Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@nextui-org/theme/dist/components/(checkbox|modal|pagination|popover|progress|slider|spinner|tabs|button|ripple).js"
  ],
  theme: {
    extend: {
      fontFamily: {
        "display": "var(--chivo), sans",
        "body": "var(--inter), sans"
      }
    },
  },
  safelist: [
    ...["red-600", "rose-600", "orange-600", "amber-600", "cyan-600", "green-600", "white"]
      .flatMap(x=> [`bg-${x}`, `text-${x}`, `stroke-${x}/10`, `stroke-${x}`]),
    "bg-blue-100",
    
    //chip colors
    //tried importing them here from util but that's not allowed
    //& im too lazy to make another file...
    "border-cyan-400 bg-sky-300",
    "border-gray-300 bg-gray-600",
    "bg-purple-600 border-purple-300",
    "bg-[#64919b] border-[#67cce0]"
  ],
  plugins: [nextui({
    layout: {
      disabledOpacity: "1.0"
    }
  })],
}