import { ChatPlugin, listen, respond, help, permissionGroup } from '@exoplay/exobot';

export class Voting extends ChatPlugin {
  name = 'voting';

  defaultDatabase = {
    quickpoll: { votes: [], poll: {
      open: false,
      question: '',
      timeout: 0,
      userID: '',
    } },
    voting: { votes: [], measures: [] },
  };

  _requiresDatabase = true;

  propTypes = {};

  @permissionGroup('public');
  @help('Votes list - Lists all votes that are open and 3 recent closed votes');
  @respond(/^votes list/i);
  async listVotes() {
    await this.databaseInitialized();
    const voteList = [];
    const closedList = [];
    const currentPoll = this.bot.db.get('quickpoll.poll').value();
    let pollCount = 0;
    if (currentPoll.open === true) {
      voteList.push(`Open quickpoll: ${currentPoll.question}\n`);
      pollCount++;
    }

    voteList.push('Open Polls:');
    this.bot.db.get('voting.measures')
      .forEach((m) => {
        const measureIDString = `000${m.id.toString(36)}`.slice(-3);
        if (m.open) {
          pollCount++;
          voteList.push(`Measure $${measureIDString}: ${m.text}`);
        } else {
          pollCount++;
          closedList.push(`Measure $${measureIDString}: ${m.text}`);
        }
      })
      .value();
    const closedText = closedList.slice(closedList.length-3)
      .join('\n');
    if (pollCount > 0) {
      return `${voteList.join('\n')}\n\nClosed Polls:\n${closedText}`;
    }

    return 'No quickpolls or measures found';
  }

  @permissionGroup('manageVotes');
  @help('Votes delete quickpoll - Closes open quickpoll\n' +
        'Votes delete measure $id - Closes measure $id');
  @respond(/^votes delete\s+(quickpoll|measure)\s*(?:\$(\w{3}))?/i);
  async deleteVoteAdmin([, type, id], message) {
    await this.databaseInitialized();
    if (type === 'quickpoll') {
      const selectedPoll = this.bot.db.get('quickpoll.poll').value();
      if (selectedPoll.userID !== message.user.id) {
        return this.deleteVote(type, id, message);
      }
    }

    const selectedPoll = this.bot.db.get('voting.measures')
      .filter({id: parseInt(id, 36)})
      .first()
      .value();
    if (selectedPoll.userID !== message.user.id) {
      return this.deleteVote(type, id, message);
    }
  }

  @permissionGroup('public');
  @help('Votes delete quickpoll - Closes open quickpoll\n' +
        'Votes delete measure $id - Closes measure $id');
  @respond(/^votes delete\s+(quickpoll|measure)\s*(?:\$(\w{3}))?/i);
  async deleteVoteOwned([, type, id], message) {
    await this.databaseInitialized();
    if (type === 'quickpoll') {
      const selPoll = this.bot.db.get('quickpoll.poll').value();
      if (selPoll.userID === message.user.id) {
        return this.deleteVote(type, id, message);
      }
    }

    const selPoll = this.bot.db.get('voting.measures')
      .filter({id: parseInt(id, 36)})
      .first()
      .value();
    if (selPoll.userID === message.user.id) {
      return this.deleteVote(type, id, message);
    }

  }

  async deleteVote(type, id) {
    if (type === 'quickpoll') {
      this.initQuickpoll();
      return 'Quickpoll has been deleted.';
    }

    const measureID = parseInt(id, 36);
    this.bot.db.get('voting.measures')
      .remove(m => m.id === measureID)
      .value();
    this.bot.db.get('voting.votes')
      .remove(m => m.measureID === measureID)
      .value();
    return `Measure ${id} deleted.`;
  }

  @permissionGroup('manageVotes');
  @help('Votes close quickpoll - Closes open quickpoll\n' +
        'Votes close measure $id - Closes measure $id');
  @respond(/^votes close\s+(quickpoll|measure)\s*(?:\$(\w{3}))?/i);
  async closeVoteAdmin([, type, id], message) {
    await this.databaseInitialized();
    if (type === 'quickpoll') {
      const selPoll = this.bot.db.get('quickpoll.poll').value();
      if (selPoll.userID !== message.user.id) {
        return this.closeVote(type, id, message);
      }
    }

    const selPoll = this.bot.db.get('voting.measures')
      .filter({id: parseInt(id, 36)})
      .first()
      .value();
    if (selPoll.userID !== message.user.id) {
      return this.closeVote(type, id, message);
    }
  }

  @permissionGroup('public');
  @help('Votes close quickpoll - Closes open quickpoll\n' +
        'Votes close measure $id - Closes measure $id');
  @respond(/^votes close\s+(quickpoll|measure)\s*(?:\$(\w{3}))?/i);
  async closeVoteOwned([,type, id], message) {
    await this.databaseInitialized();
    if (type === 'quickpoll') {
      const selPoll = this.bot.db.get('quickpoll.poll').value();
      if (selPoll.userID === message.user.id) {
        return this.closeVote(type, id, message);
      }
    }

    const selPoll = this.bot.db.get('voting.measures')
      .filter({id: parseInt(id, 36)})
      .first()
      .value();
    if (selPoll.userID === message.user.id) {
      return this.closeVote(type, id, message);
    }
  }

  async closeVote(type, id) {
    if (type === 'quickpoll') {
      const currentPoll = this.bot.db.get('quickpoll.poll').value();
      if (currentPoll.open === true) {
        this.bot.db.set('quickpoll.poll.open', false).value();
        return `Poll "${currentPoll.question}" has been closed.`;
      }

      return 'No quickpoll open.';
    }

    const currentMeasure = this.bot.db.get('voting.measures')
      .filter({id: parseInt(id, 36)})
      .first()
      .value();
    if (currentMeasure.open === true) {
      currentMeasure.open = false;
      return `Measure "${currentMeasure.text}" has been closed.`;
    }

    return 'No vote with that ID open.';
  }

  @permissionGroup('public');
  @help('Votes results [$id] - Outputs the results of quickpoll or measure with optional $id');
  @respond(/^votes results\s*(?:\$(\w{3}))?/i);
  async results ([, id]) {
    let results;
    const resultsSorted = [];
    let response;
    await this.databaseInitialized();
    if (id) {
      const measureNum = parseInt(id, 36);
      const currentMeasure = this.bot.db.get('voting.measures')
        .filter({id: measureNum})
        .first()
        .value();
      if (currentMeasure) {
        results = this.bot.db.get('voting.votes')
          .filter({measureID: measureNum})
          .countBy((m) => m.response)
          .value();
        response = `Voting results for $${id} ${currentMeasure.text}:\n`;
      }
    } else {
      const currentPoll = this.bot.db.get('quickpoll.poll').value();
      if (currentPoll.text === '') {
        return 'No Quickpoll running.';
      }

      results = this.bot.db.get('quickpoll.votes')
        .countBy((m) => m.response)
      .value();
      response = `Voting results for "${currentPoll.question}":\n`;
    }

    if (Object.keys(results).length === 0) {
      return 'No votes yet';
    }

    for (const k in results) {
      if (results.hasOwnProperty(k)) {
        resultsSorted.push({key:k, value:results[k]});
      }
    }

    if (resultsSorted.length > 1) {
      resultsSorted.sort((a,b) => b.value-a.value);
    }

    resultsSorted.forEach((val) => {
      response += `${val.key} recieved ${val.value} point${val.value === 1 ? '':'s'}\n`;
    });
    return response;
  }

  @permissionGroup('createVotes');
  @help('Votes create quickpoll "Your question" - Creates quickpoll\n' +
        'Votes create measure "Your Question"|"Option 1"|"Option 2"|[other] - ' +
        'Creates measure with options and optional other entry\n');
  @respond(/^votes create\s+(quickpoll|measure)\s+(.+)/i);
  async createVote([, type, pollText], message) {
    await this.databaseInitialized();
    if (type === 'quickpoll') {
      if (this.bot.db.get('quickpoll.poll.open').value() === false) {
        this.initQuickpoll(true, message.user.id, pollText);
        return `Quickpoll created: ${pollText} type "vote <your vote>" to respond.`;
      }

      return 'Cannot create quickpoll.  Quickpoll already in progress.';
    }

    const measureDetails = pollText.split('|');
    const measure = {
      id: this.getNextMeasureID(),
      text: measureDetails[0],
      choices: measureDetails.slice(1),
      allowOther: measureDetails.includes('other'),
      open: true,
      timeout: 0,
      userID: message.user.id,
    };
    const measureIDString = `000${measure.id.toString(36)}`.slice(-3);
    this.bot.db.get('voting.measures')
      .push(measure)
      .value();
    let measureText = `Measure created: ${measure.text} Choices:\n`;
    let choiceNum = 0;
    measure.choices.forEach((choice) => {
      if (choice !== 'other') {
        measureText += `${++choiceNum}.\t${choice}\n`;
      }
    });
    measureText += `Type "vote $${measureIDString} 1-${choiceNum}"`;
    measureText += `${measure.allowOther ? ` or "vote $${measureIDString} <your vote>" ` : ' '}`;
    measureText += 'to place your vote.';
    return measureText;
  }

  @permissionGroup('public');
  @listen(/^vote[^s]\s*(?:\$(\w{3})\s*)?([^\$]{1}.*)?/i);
  async vote([match, id, voteText], message) {
    await this.databaseInitialized();
    if (id && voteText) {  //VoteID and Vote present
      const responseNum = parseInt(voteText)-1;
      const measureNum = parseInt(id, 36);
      let responseText;
      const currentMeasure = this.bot.db.get('voting.measures')
        .filter({id: measureNum, open: true})
        .first()
        .value();
      if (currentMeasure) {
        const maxChoice = currentMeasure.choices.length - (currentMeasure.allowOther ? 2 : 1);
        if (!isNaN(responseNum)) {
          if (responseNum >= 0 && responseNum <= maxChoice) {
            responseText = currentMeasure.choices[responseNum];
          } else {
            return `Invaid vote option ${voteText}`;
          }
        } else if (currentMeasure.allowOther) {
          responseText = voteText;
        } else {
          return `Invalid vote option ${voteText}`;
        }

        const vote = this.buildVote(false,
          measureNum,
          responseText,
          message.user.id,);
        this.bot.db.get('voting.votes')
          .push(vote)
          .value();
      } else {
        return 'No vote with that ID open.';
      }
    } else if (voteText) {  //Quickpoll vote present
      const currentPoll = this.bot.db.get('quickpoll.poll').value();
      if (currentPoll.open === true) {
        const vote = this.buildVote(true, '', voteText, message.user.id);
        this.bot.db.get('quickpoll.votes')
          .push(vote)
          .value();
      }
    } else {  //No vote present
      if (id) {
        const currentMeasure = this.bot.db.get('voting.measures')
          .filter({id: parseInt(id, 36), open: true})
          .first()
          .value();
        const measureIDString = `000${currentMeasure.id.toString(36)}`.slice(-3);
        let measureText = `Measure: ${currentMeasure.text} Choices:\n`;
        let choiceNum = 1;
        currentMeasure.choices.forEach((choice) => {
          if (choice !== 'other') {
            measureText += `${choiceNum++}.\t${choice}\n`;
          }
        });
        measureText += `Type "vote $${measureIDString} 1-${choiceNum - 1}""`;
        if (currentMeasure.allowOther) {
          measureText += ` or "vote $${measureIDString} <your vote>"`;
        }
        measureText += ' to place your vote.';
        return measureText;
      }

      const currentPoll = this.bot.db.get('quickpoll.poll').value();
      if (!currentPoll.open) {
        return 'No Quickpoll running.';
      }

      return `Quickpoll: ${currentPoll.question} type "vote your response" to respond.`;
    }
  }

  buildVote (quickpoll, measure, responseText, userID) {
    if (quickpoll) {
      return {
        response: responseText,
        user: userID,
        timestamp: Date.now(),
      };
    }
    return {
      measureID: measure,
      response: responseText,
      user: userID,
      timestamp: Date.now(),
    };

  }

  getNextMeasureID() {
    const highMeasure = this.bot.db.get('voting.measures')
      .maxBy('id')
      .value();
    if (highMeasure) {
      return highMeasure.id + 1;
    }

    return 1;
  }

  async initQuickpoll(pollState, user, questiontext, polltimeout) {
    await this.databaseInitialized();
    const pollOptions = {
      open: pollState || false,
      question: questiontext || '',
      timeout: polltimeout || 0,
      userID: user || '',
    };
    this.bot.db.set('quickpoll.poll',pollOptions).value();
    this.bot.db.set('quickpoll.votes', [])
      .value();
  }
}
