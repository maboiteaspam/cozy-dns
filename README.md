# Cozy-dns

A frontend UI to manage a bunch of DNS&DHT able node.

Create a peer. Then few more peers.

They will connect each other and create a DHT table on your localhost.

Select any node, attach it a domain.

Domain must at least |sld.tld| IE : whatever.com, what.ever.com, what.so.ever.com ect

Try to resolve the domain from this node, it will use local lookup (Plain object).

Try to resolve the domain from another node, it will fallback to a DHT query.

It will transform the domain name string into a torrent file.

Perform a DHT.lookup of the torrent.infoHash value, then record a new transaction.

Meanwhile, it also listens to DHT.on('peer') event.

When a peer is found, if a transaction exists for such torrent.infoHash, the DNS query is solved and returned.

Note: currently K is reduced to 1.

### Run it

```
mkdir myplayground
cd myplayground
npm i maboiteaspam/cozy-dns
node index.js
```

### /!\ It s a work in progress


### Problems to solve

##### Weird behavior of the nodes, choked nodes ?

Sometimes you create 10 nodes, then some of them starts to have distance: -1 towards one to all other nodes.

From that moment this peer seems dead. Resolving again and again does not help to make it work again.

At best the node can be fixed and work again when it is asked to resolve a domain.

##### Test IRL

Need to find some way to test it in real life in order to evaluate its behavior.

