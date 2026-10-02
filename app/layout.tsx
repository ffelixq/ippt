import type { Metadata, Viewport } from 'next';
import './globals.css';
import './stride-ui.css';
export const metadata: Metadata={title:'Stride — Your IPPT training',description:'A flexible training plan, exercise guide and progress journal for your next IPPT.',icons:{icon:'/favicon.svg'},manifest:'/manifest.webmanifest'};
export const viewport: Viewport={width:'device-width',initialScale:1,viewportFit:'cover',interactiveWidget:'resizes-content',themeColor:'#f5f5f7'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
