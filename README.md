# Cozy-dns

A frontend UI to manage a bunch of DNS&DHT able node.

Create a peer. Then few more peers, currently K is reduced to 1.

It will connect to a local DHT table.

Attach it a domain.

Try to resolve the domain from this node or a new you d create.


### Run it

```
mkdir myplayground
cd myplayground
npm i maboiteaspam/cozy-dns
node index.js
```

### /!\ It s a work in progress


### Problems to solve

Sometimes you create 10 nodes, then some of them starts to have distance: -1 towards one to all other nodes.

From that moment this peer seems dead. Resolving again and again does not help to make it work again.

At best the node can be fixed and work again when it is asked to resolve a domain.