import {registerHooks} from 'node:module';
// Native TypeScript tests on Node 24; production uses the framework resolver.
registerHooks({resolve(specifier,context,next){try{return next(specifier,context)}catch(error){if((specifier.startsWith('./')||specifier.startsWith('../'))&&!/\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);throw error}}});
await import('./core.mjs');
await import('./intervals.mjs');
await import('./training.mjs');
await import('./logging.mjs');
await import('./exports.mjs');
