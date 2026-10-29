/* A curated, searchable library. GIF media stays hosted by its credited source. */
(() => {
  const items = [
  {
    "id": "wave",
    "provider": "giphy",
    "providerId": "xT9IgG50Fb7Mi0prBC",
    "title": "Hello there",
    "category": "Reactions",
    "tags": [
      "hello",
      "hi",
      "hey",
      "wave",
      "greeting",
      "welcome"
    ],
    "width": 200,
    "height": 100
  },
  {
    "id": "hello",
    "provider": "giphy",
    "providerId": "dzaUX7CAG0Ihi",
    "title": "A friendly hello",
    "category": "Reactions",
    "tags": [
      "hello",
      "hi",
      "hey",
      "wave",
      "greeting",
      "welcome"
    ],
    "width": 200,
    "height": 108
  },
  {
    "id": "thumbs-up",
    "provider": "giphy",
    "providerId": "111ebonMs90YLu",
    "title": "Looking good",
    "category": "Reactions",
    "tags": [
      "yes",
      "okay",
      "ok",
      "thumbs",
      "up",
      "approve",
      "nice",
      "great"
    ],
    "width": 200,
    "height": 150
  },
  {
    "id": "love",
    "provider": "giphy",
    "providerId": "26FLgGTPUDH6UGAbm",
    "title": "Sending love",
    "category": "Reactions",
    "tags": [
      "love",
      "heart",
      "thanks",
      "thank",
      "you",
      "hugs",
      "cute"
    ],
    "width": 200,
    "height": 122
  },
  {
    "id": "laugh",
    "provider": "giphy",
    "providerId": "ZqlvCTNHpqrio",
    "title": "Can’t stop laughing",
    "category": "Reactions",
    "tags": [
      "laugh",
      "lol",
      "lmao",
      "funny",
      "happy",
      "haha"
    ],
    "width": 200,
    "height": 108
  },
  {
    "id": "applause",
    "provider": "giphy",
    "providerId": "l3q2K5jinAlChoCLS",
    "title": "A round of applause",
    "category": "Celebrate",
    "tags": [
      "applause",
      "clap",
      "congratulations",
      "congrats",
      "well",
      "done"
    ],
    "width": 200,
    "height": 236
  },
  {
    "id": "celebrate",
    "provider": "giphy",
    "providerId": "g9582DNuQppxC",
    "title": "Time to celebrate",
    "category": "Celebrate",
    "tags": [
      "celebrate",
      "happy",
      "dance",
      "party",
      "yay",
      "excited"
    ],
    "width": 200,
    "height": 112
  },
  {
    "id": "excited",
    "provider": "giphy",
    "providerId": "artj92V8o75VPL7AeQ",
    "title": "Very excited",
    "category": "Celebrate",
    "tags": [
      "excited",
      "happy",
      "yes",
      "celebrate",
      "party",
      "yay"
    ],
    "width": 200,
    "height": 200
  },
  {
    "id": "thank-you",
    "provider": "giphy",
    "providerId": "osjgQPWRx3cac",
    "title": "Thank you",
    "category": "Reactions",
    "tags": [
      "thanks",
      "thank",
      "you",
      "grateful",
      "appreciate"
    ],
    "width": 200,
    "height": 200
  },
  {
    "id": "wow",
    "provider": "giphy",
    "providerId": "5VKbvrjxpVJCM",
    "title": "Wow",
    "category": "Reactions",
    "tags": [
      "wow",
      "surprised",
      "amazed",
      "excited",
      "what"
    ],
    "width": 200,
    "height": 160
  },
  {
    "id": "confused",
    "provider": "giphy",
    "providerId": "qFxlqjtA3m44U",
    "title": "Kitten cuddles",
    "category": "Animals",
    "tags": [
      "cat",
      "cats",
      "kittens",
      "cute",
      "cuddle",
      "love",
      "hug"
    ],
    "width": 200,
    "height": 142
  },
  {
    "id": "facepalm",
    "provider": "giphy",
    "providerId": "TJawtKM6OCKkvwCIqX",
    "title": "Oh no",
    "category": "Reactions",
    "tags": [
      "facepalm",
      "oops",
      "oh",
      "no",
      "fail",
      "awkward"
    ],
    "width": 200,
    "height": 148
  },
  {
    "id": "sad",
    "provider": "giphy",
    "providerId": "OPU6wzx8JrHna",
    "title": "Feeling sad",
    "category": "Reactions",
    "tags": [
      "sad",
      "upset",
      "disappointed",
      "no",
      "crying"
    ],
    "width": 200,
    "height": 164
  },
  {
    "id": "crying",
    "provider": "giphy",
    "providerId": "d2lcHJTG5Tscg",
    "title": "All the feelings",
    "category": "Reactions",
    "tags": [
      "cry",
      "crying",
      "sad",
      "tears",
      "emotion"
    ],
    "width": 200,
    "height": 112
  },
  {
    "id": "sleepy",
    "provider": "giphy",
    "providerId": "mkhMTALnrYRLnuoe5P",
    "title": "Getting sleepy",
    "category": "Vibes",
    "tags": [
      "sleep",
      "sleepy",
      "tired",
      "bedtime",
      "night"
    ],
    "width": 200,
    "height": 150
  },
  {
    "id": "cozy-cat",
    "provider": "giphy",
    "providerId": "GeimqsH0TLDt4tScGw",
    "title": "Cozy cat",
    "category": "Animals",
    "tags": [
      "cat",
      "cats",
      "kitten",
      "cute",
      "cozy",
      "sleep",
      "pet"
    ],
    "width": 200,
    "height": 134
  },
  {
    "id": "dog",
    "provider": "giphy",
    "providerId": "kiBcwEXegBTACmVOnE",
    "title": "Good dog energy",
    "category": "Animals",
    "tags": [
      "dog",
      "dogs",
      "puppy",
      "puppies",
      "cute",
      "happy",
      "pet",
      "gaming",
      "game",
      "games",
      "controller"
    ],
    "width": 200,
    "height": 250
  },
  {
    "id": "popcorn",
    "provider": "giphy",
    "providerId": "pUeXcg80cO8I8",
    "title": "Just watching",
    "category": "Reactions",
    "tags": [
      "popcorn",
      "watching",
      "waiting",
      "drama",
      "interesting"
    ],
    "width": 200,
    "height": 150
  },
  {
    "id": "deal",
    "provider": "giphy",
    "providerId": "3oEjI4sFlp73fvEYgw",
    "title": "You got it",
    "category": "Reactions",
    "tags": [
      "deal",
      "yes",
      "okay",
      "ok",
      "agree",
      "got",
      "it"
    ],
    "width": 200,
    "height": 112
  },
  {
    "id": "yes",
    "provider": "giphy",
    "providerId": "DffShiJ47fPqM",
    "title": "Absolutely yes",
    "category": "Reactions",
    "tags": [
      "yes",
      "agree",
      "okay",
      "ok",
      "approve"
    ],
    "width": 200,
    "height": 132
  },
  {
    "id": "no",
    "provider": "giphy",
    "providerId": "fXnRObM8Q0RkOmR5nf",
    "title": "Definitely not",
    "category": "Reactions",
    "tags": [
      "no",
      "nope",
      "never",
      "disagree"
    ],
    "width": 200,
    "height": 200
  },
  {
    "id": "space",
    "provider": "giphy",
    "providerId": "pWhWtKdqwOAco",
    "title": "Starfield",
    "category": "Vibes",
    "tags": [
      "space",
      "adventure",
      "travel",
      "explore",
      "stars",
      "banner",
      "starfield",
      "night",
      "galaxy"
    ],
    "width": 200,
    "height": 280
  },
  {
    "id": "stars",
    "provider": "giphy",
    "providerId": "l0MYw6Cu1TfY3gsWk",
    "title": "All good",
    "category": "Reactions",
    "tags": [
      "okay",
      "ok",
      "yes",
      "nice",
      "good",
      "perfect",
      "approve"
    ],
    "width": 200,
    "height": 200
  },
  {
    "id": "fireworks",
    "provider": "giphy",
    "providerId": "26tOZ42Mg6pbTUPHW",
    "title": "Fireworks",
    "category": "Celebrate",
    "tags": [
      "fireworks",
      "celebrate",
      "party",
      "night",
      "lights",
      "banner"
    ],
    "width": 200,
    "height": 136
  },
  {
    "id": "party",
    "provider": "giphy",
    "providerId": "blSTtZehjAZ8I",
    "title": "Party time",
    "category": "Celebrate",
    "tags": [
      "party",
      "dance",
      "celebrate",
      "happy",
      "yay"
    ],
    "width": 200,
    "height": 154
  },
  {
    "id": "music",
    "provider": "giphy",
    "providerId": "tqfS3mgQU28ko",
    "title": "Music on",
    "category": "Vibes",
    "tags": [
      "music",
      "dancing",
      "vibe",
      "dance",
      "listen",
      "sound"
    ],
    "width": 200,
    "height": 150
  },
  {
    "id": "coffee",
    "provider": "giphy",
    "providerId": "DrJm6F9poo4aA",
    "title": "Coffee time",
    "category": "Vibes",
    "tags": [
      "coffee",
      "morning",
      "tired",
      "cozy",
      "drink"
    ],
    "width": 200,
    "height": 200
  },
  {
    "id": "gaming",
    "provider": "giphy",
    "providerId": "w8VuZaBbV7Adi",
    "title": "Well done",
    "category": "Celebrate",
    "tags": [
      "well",
      "done",
      "applause",
      "clap",
      "congrats",
      "bravo",
      "nice",
      "great"
    ],
    "width": 200,
    "height": 96
  },
  {
    "id": "thinking",
    "provider": "giphy",
    "providerId": "a5viI92PAF89q",
    "title": "Thinking it over",
    "category": "Reactions",
    "tags": [
      "think",
      "thinking",
      "question",
      "confused",
      "hmm"
    ],
    "width": 200,
    "height": 138
  },
  {
    "id": "shy",
    "provider": "giphy",
    "providerId": "dILrAu24mU729pxPYN",
    "title": "A knowing smile",
    "category": "Reactions",
    "tags": [
      "shy",
      "blush",
      "cute",
      "awkward",
      "hello"
    ],
    "width": 200,
    "height": 150
  },
  {
    "id": "cheers",
    "provider": "giphy",
    "providerId": "8Iv5lqKwKsZ2g",
    "title": "Cheers",
    "category": "Celebrate",
    "tags": [
      "cheers",
      "toast",
      "celebrate",
      "congrats",
      "happy"
    ],
    "width": 200,
    "height": 84
  }
].map(item=>Object.freeze({...item,
    url:'https://media.giphy.com/media/'+item.providerId+'/giphy.gif',
    previewUrl:'https://media.giphy.com/media/'+item.providerId+'/200w.gif',
    stillUrl:'https://media.giphy.com/media/'+item.providerId+'/200w_s.gif',
    sourceUrl:'https://giphy.com/gifs/'+item.providerId
  }));
  const lookup=new Map(items.map(item=>[item.id,item]));
  const get=id=>lookup.get(id) || null;
  const search=(query='',category='All')=>{
    const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return items.filter(item=>(category==='All'||item.category===category)&&words.every(word=>(item.title+' '+item.tags.join(' ')).toLowerCase().includes(word)));
  };
  const metadata=id=>{const item=get(id);if(!item)throw new Error('Choose a GIF from the library.');return {id:item.id,provider:item.provider,providerId:item.providerId,title:item.title,url:item.url,previewUrl:item.previewUrl,stillUrl:item.stillUrl,sourceUrl:item.sourceUrl,width:item.width,height:item.height};};
  window.LyriaGifLibrary=Object.freeze({get,search,metadata,categories:Object.freeze(['All','Reactions','Celebrate','Animals','Vibes']),count:items.length});
})();
