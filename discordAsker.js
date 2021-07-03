// noinspection JSMismatchedCollectionQueryUpdate,JSUnusedLocalSymbols

function discordAsker() {
    let invitedPeople = []
    let rejectedPeople = []
    let pendingInvites = []

    function addDiscordInviteMessage(discordUserNameDiscrim, discordUserId, discordAvatarSecret) {
        console.log(`Invite request from ${discordUserNameDiscrim}`)
        if (pendingInvites.includes(discordUserId)) {
            return
        }

        pendingInvites.push(discordUserId)
        let avatarUrl;

        if (discordAvatarSecret.startsWith('a_')) {
            avatarUrl = `https://cdn.discordapp.com/avatars/${discordUserId}/${discordAvatarSecret}.gif?size=32`
        } else {
            avatarUrl = `https://cdn.discordapp.com/avatars/${discordUserId}/${discordAvatarSecret}.png?size=32`
        }

        let $chatMessageContainer = $('#gcMessageContainer')
        let $li = $('<li>' +
            '<img class="amqEmoji" src="https://animemusicquiz.com/img/ui/discord.png" sizes="28px" alt="discord"> ' +
            `<img class="amqEmoji" src="${avatarUrl}" sizes="28px" alt="avatar"> ` +
            `<b>${discordUserNameDiscrim}</b> wants to join this game!\n` +
            `<a href="JavaScript:void(0);" onclick="acceptInvite('${discordUserId}')">Invite to game!</a>\n` +
            `<a href="JavaScript:void(0);" onclick="rejectInvite('${discordUserId}')">Reject the invite!</a>` +
            '</li>')
        $chatMessageContainer.append($li)

        // remove invite restriction after a minute
        setTimeout(() => {
            let index = pendingInvites.indexOf(discordUserId)
            if (index > -1) {
                pendingInvites.splice(index, 1)
            }
        }, 60_000)
    }

    function acceptInvite(discordUserId) {
        let index = pendingInvites.indexOf(discordUserId)
        if (index > -1) {
            invitedPeople.push(discordUserId)
            pendingInvites.splice(index, 1)
        }
    }

    function rejectInvite(discordUserId) {
        let index = pendingInvites.indexOf(discordUserId)
        if (index > -1) {
            rejectedPeople.push(discordUserId)
            pendingInvites.splice(index, 1)
        }
    }

    function inviteSent(discordUserId) {
        let index = invitedPeople.indexOf(discordUserId)
        if (index > -1) {
            invitedPeople.splice(index, 1)
        }
        index = rejectedPeople.indexOf(discordUserId)
        if (index > -1) {
            rejectedPeople.splice(index, 1)
        }
    }
}

module.exports = {discordAsker}