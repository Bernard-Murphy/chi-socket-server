
        
        self.addEventListener("install", e => {
            const version = 14;
            console.log('Installing version', version);
            caches.keys().then(files => {
                console.log('Removing old...');
                files.forEach(file => caches.delete(file));
                e.waitUntil(
                    caches.open('static').then(cache => {
                        console.log('caching...');
                        return cache.addAll([])
                    })
                );
            })
            
        });
        
        self.addEventListener('fetch', e => {
            if (e && e !== undefined && e.request.method === 'GET'){
                e.respondWith(
                    caches.match(e.request).then(res => {
                        return res || fetch(e.request);
                    })
                )
            }
            
        });
    