import { Plugin, listen, respond, help, permissionGroup } from '@exoplay/exobot';

export default class Voting extends Plugin {
  static type = 'voting';

  static defaultDatabase = {
    quickpoll: {
      votes: [],
      poll: {
        open: false,
        question: '',
        timeout: 0,
        userID: '',
      },
    },
    voting: { votes: [], polls: [] },
  };

  static _requiresDatabase = true;

  static propTypes = {};

  @permissionGroup('public');
  @help('/list votes - Lists all votes that are open and 3 recent closed votes');
  @respond(/^list votes$/i);
  async listVotes() {
    const voteList = [];
    const closedList = [];
    const currentPoll = this.bot.db.get('quickpoll.poll').value();
    let pollCount = 0;
    if (currentPoll.open === true) {
      voteList.push(`Open quickpoll: ${currentPoll.question}\n`);
      pollCount += 1;
    }

    voteList.push('Open Polls:');
    this.bot.db.get('voting.polls')
      .forEach((m) => {
        const pollIDString = `000${m.id.toString(36)}`.slice(-3);
        if (m.open) {
          pollCount += 1;
          voteList.push(`Poll $${pollIDString}: ${m.text}`);
        } else {
          pollCount += 1;
          closedList.push(`Poll $${pollIDString}: ${m.text}`);
        }
      })
      .value();
    const closedText = closedList.slice(closedList.length - 3)
      .join('\n');
    if (pollCount > 0) {
      return `${voteList.join('\n')}\n\nClosed Polls:\n${closedText}`;
    }

    return 'No quickpolls or polls found';
  }

  @permissionGroup('manageVotes');
  @help('/delete quickpoll - Deletes quickpoll\n' +
        '/delete poll $id - Deletes poll $id');
  @respond(/^delete\s+(quickpoll|poll)\s*(?:\$(\w{3}))?/i);
  async deleteVoteAdmin([, type, id], message) {
    if (type === 'quickpoll') {
      const selectedPoll = this.bot.db.get('quickpoll.poll').value();
      if (selectedPoll.userID !== message.user.id) {
        return this.deleteVote(type, id, message);
      }
    }

    const selectedPoll = this.bot.db.get('voting.polls')
      .filter({ id: parseInt(id, 36) })
      .first()
      .value();
    if (selectedPoll.userID !== message.user.id) {
      return this.deleteVote(type, id, message);
    }
  }

  @permissionGroup('public');
  @help('/delete quickpoll - Deletes quickpoll\n' +
        '/delete poll $id - Deletes poll $id');
  @respond(/^delete\s+(quickpoll|poll)\s*(?:\$(\w{3}))?/i);
  async deleteVoteOwned([, type, id], message) {
    if (type === 'quickpoll') {
      const selPoll = this.bot.db.get('quickpoll.poll').value();
      if (selPoll.userID === message.user.id) {
        return this.deleteVote(type, id, message);
      }
    }

    const selPoll = this.bot.db.get('voting.polls')
      .filter({ id: parseInt(id, 36) })
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

    const pollID = parseInt(id, 36);
    this.bot.db.get('voting.polls')
      .remove(m => m.id === pollID)
      .value();
    this.bot.db.get('voting.votes')
      .remove(m => m.pollID === pollID)
      .value();
    return `Poll ${id} deleted.`;
  }

  @permissionGroup('manageVotes');
  @help('/close quickpoll - Closes open quickpoll\n' +
        '/close poll $id - Closes poll $id');
  @respond(/^close\s+(quickpoll|poll)\s*(?:\$(\w{3}))?/i);
  async closeVoteAdmin([, type, id], message) {
    if (type === 'quickpoll') {
      const selPoll = this.bot.db.get('quickpoll.poll').value();
      if (selPoll.userID !== message.user.id) {
        return this.closeVote(type, id, message);
      }
    }

    const selPoll = this.bot.db.get('voting.polls')
      .filter({ id: parseInt(id, 36) })
      .first()
      .value();
    if (selPoll.userID !== message.user.id) {
      return this.closeVote(type, id, message);
    }
  }

  @permissionGroup('public');
  @help('/close quickpoll - Closes open quickpoll\n' +
        '/close poll $id - Closes poll $id');
  @respond(/^close\s+(quickpoll|poll)\s*(?:\$(\w{3}))?/i);
  async closeVoteOwned([, type, id], message) {
    if (type === 'quickpoll') {
      const selPoll = this.bot.db.get('quickpoll.poll').value();
      if (selPoll.userID === message.user.id) {
        return this.closeVote(type, id, message);
      }
    }

    const selPoll = this.bot.db.get('voting.polls')
      .filter({ id: parseInt(id, 36) })
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

    const currentPoll = this.bot.db.get('voting.polls')
      .filter({ id: parseInt(id, 36) })
      .first()
      .value();
    if (currentPoll.open === true) {
      currentPoll.open = false;
      return `Poll "${currentPoll.text}" has been closed.`;
    }

    return 'No vote with that ID open.';
  }

  @permissionGroup('public');
  @help('/voting results [$id] - Outputs the results of quickpoll or poll when $id is specified');
  @respond(/^voting results\s*(?:\$(\w{3}))?/i);
  async results([, id]) {
    let results;
    let response;
    if (id) {
      const pollNum = parseInt(id, 36);
      const currentPoll = this.bot.db.get('voting.polls')
        .filter({ id: pollNum })
        .first()
        .value();
      if (currentPoll) {
        results = this.bot.db.get('voting.votes')
          .filter({ pollID: pollNum })
          .countBy(m => m.response)
          .value();
        response = `Voting results for $${id} ${currentPoll.text}:\n`;
      }
    } else {
      const currentPoll = this.bot.db.get('quickpoll.poll').value();
      if (currentPoll.text === '') {
        return 'No Quickpoll running.';
      }

      results = this.bot.db.get('quickpoll.votes')
        .countBy(m => m.response)
        .value();
      response = `Voting results for "${currentPoll.question}":\n`;
    }

    if (Object.keys(results).length === 0) {
      return 'No votes yet';
    }
    console.log(results);
    const resultsSorted = Object.keys(results).map(k => ({ key: k, value: results[k] }));
    if (resultsSorted.length > 1) {
      resultsSorted.sort((a, b) => b.value - a.value);
    }

    resultsSorted.forEach((val) => {
      response += `${val.key} recieved ${val.value} point${val.value === 1 ? '' : 's'}\n`;
    });
    return response;
  }

  @permissionGroup('createVotes');
  @help('/create quickpoll "Your question" - Creates quickpoll\n' +
        '/create poll "Your Question"|"Option 1"|"Option 2"|"Option n"|[other] - ' +
        'Creates poll with options and optional other entry\n');
  @respond(/^create\s+(quickpoll|poll)\s+(.+)/i);
  async createVote([, type, pollText], message) {
    if (type === 'quickpoll') {
      if (this.bot.db.get('quickpoll.poll.open').value() === false) {
        this.initQuickpoll(true, message.user.id, pollText);
        return `Quickpoll created: ${pollText} type "vote <your vote>" to respond.`;
      }

      return 'Cannot create quickpoll.  Quickpoll already in progress.';
    }

    const pollDetails = pollText.split('|');
    const poll = {
      id: this.getNextPollID(),
      text: pollDetails[0],
      choices: pollDetails.slice(1),
      allowOther: pollDetails.includes('other'),
      open: true,
      timeout: 0,
      userID: message.user.id,
    };
    const pollIDString = `000${poll.id.toString(36)}`.slice(-3);
    this.bot.db.get('voting.polls')
      .push(poll)
      .value();
    let pollConfirmation = `Poll created: ${poll.text} Choices:\n`;
    let choiceNum = 0;
    poll.choices.forEach((choice) => {
      if (choice !== 'other') {
        choiceNum += 1;
        pollConfirmation += `${choiceNum}.\t${choice}\n`;
      }
    });
    pollConfirmation += `Type "vote $${pollIDString} 1-${choiceNum}"`;
    pollConfirmation += `${poll.allowOther ? ` or "vote $${pollIDString} <your vote>" ` : ' '}`;
    pollConfirmation += 'to place your vote.';
    return pollConfirmation;
  }

  @permissionGroup('public');
  @respond(/^vote (?:\$(\w{3})\s*)?([^\$]{1}.*)?/i);
  @listen(/^vote (?:\$(\w{3})\s*)?([^\$]{1}.*)?/i);
  async vote([match, id, voteText], message) {
    if (id && voteText) {  // VoteID and Vote present
      const responseNum = parseInt(voteText, 10) - 1;
      const pollNum = parseInt(id, 36);
      let responseText;
      const currentPoll = this.bot.db.get('voting.polls')
        .filter({ id: pollNum, open: true })
        .first()
        .value();
      if (currentPoll) {
        const maxChoice = currentPoll.choices.length - (currentPoll.allowOther ? 2 : 1);
        if (!isNaN(responseNum)) {
          if (responseNum >= 0 && responseNum <= maxChoice) {
            responseText = currentPoll.choices[responseNum];
          } else {
            return `Invaid vote option ${voteText}`;
          }
        } else if (currentPoll.allowOther) {
          responseText = voteText;
        } else {
          return `Invalid vote option ${voteText}`;
        }

        const vote = this.buildVote(false,
          pollNum,
          responseText,
          message.user.id);
        this.bot.db.get('voting.votes')
          .push(vote)
          .value();
      } else {
        return 'No vote with that ID open.';
      }
    } else if (voteText) {  // Quickpoll vote present
      const currentPoll = this.bot.db.get('quickpoll.poll').value();
      if (currentPoll.open === true) {
        const vote = this.buildVote(true, '', voteText, message.user.id);
        this.bot.db.get('quickpoll.votes')
          .push(vote)
          .value();
      }
    } else {  // No vote present
      if (id) {
        const currentPoll = this.bot.db.get('voting.polls')
          .filter({ id: parseInt(id, 36), open: true })
          .first()
          .value();
        const pollIDString = `000${currentPoll.id.toString(36)}`.slice(-3);
        let pollText = `Poll: ${currentPoll.text} Choices:\n`;
        let choiceNum = 1;
        currentPoll.choices.forEach((choice) => {
          if (choice !== 'other') {
            pollText += `${choiceNum}.\t${choice}\n`;
            choiceNum += 1;
          }
        });
        pollText += `Type "vote $${pollIDString} 1-${choiceNum - 1}""`;
        if (currentPoll.allowOther) {
          pollText += ` or "vote $${pollIDString} <your vote>"`;
        }
        pollText += ' to place your vote.';
        return pollText;
      }

      const currentPoll = this.bot.db.get('quickpoll.poll').value();
      if (!currentPoll.open) {
        return 'No Quickpoll running.';
      }

      return `Quickpoll: ${currentPoll.question} type "vote your response" to respond.`;
    }
  }

  buildVote(quickpoll, poll, responseText, userID) {
    if (quickpoll) {
      return {
        response: responseText,
        user: userID,
        timestamp: Date.now(),
      };
    }
    return {
      pollID: poll,
      response: responseText,
      user: userID,
      timestamp: Date.now(),
    };
  }

  getNextPollID() {
    const highPoll = this.bot.db.get('voting.polls')
      .maxBy('id')
      .value();
    if (highPoll) {
      return highPoll.id + 1;
    }

    return 1;
  }

  async initQuickpoll(pollState, user, questiontext, polltimeout) {
    const pollOptions = {
      open: pollState || false,
      question: questiontext || '',
      timeout: polltimeout || 0,
      userID: user || '',
    };
    this.bot.db.set('quickpoll.poll', pollOptions).value();
    this.bot.db.set('quickpoll.votes', [])
      .value();
  }
}
