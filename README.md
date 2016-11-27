# exobot-plugin-voting

Create polls with Exobot.

## Usage

* `exobot votes list`
* `exobot votes create (quickpoll | mesure) question|opt1|opt2|...`
* `exobot votes close (quickpoll | {id})`
* `vote {id} {opt}`
* `exobot votes results ({id}?)`
* `exobot votes delete (quickpoll | {id})`

## Installation

* `npm install --save @exoplay/exobot/exobot-plugin-voting`

## A Setup Example

```javascript
import Exobot from '@exoplay/exobot';
import Voting from '@exoplay/exobot-plugin-voting';

const Bot = new Exobot(BOT_NAME, {
  // ...
  plugins: [
    new Voting();
  ],
});
```

## License

LGPL licensed. Copyright 2016 Exoplay, LLC. See LICENSE file for more details.
